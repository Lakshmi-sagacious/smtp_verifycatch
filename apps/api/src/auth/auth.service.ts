import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@smtp/db';
import type {
  AuthResponse,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from '@smtp/shared';
import { generateToken, hashPassword, sha256, verifyPassword } from '../common/hash';
import { PrismaService } from '../prisma/prisma.service';

type Meta = { userAgent?: string; ip?: string };

const REFRESH_BYTES = 32;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(input: SignupInput, meta: Meta): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hashPassword(input.password);

    const { userId, verifyToken } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });
      const slug = await this.uniqueSlug(tx, input.orgName);
      const org = await tx.organization.create({
        data: { name: input.orgName, slug },
      });
      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, role: 'OWNER' },
      });
      const token = generateToken();
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
        },
      });
      return { userId: user.id, verifyToken: token };
    });

    // TODO(phase-1): send this via our own transactional API once the relay ships.
    this.logger.log(
      `[dev] email verification for ${input.email}: http://localhost:5173/verify-email?token=${verifyToken}`,
    );

    return this.issueSession(userId, meta);
  }

  async login(input: LoginInput, meta: Meta): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(user.id, meta);
  }

  async refresh(input: RefreshInput): Promise<{ accessToken: string; expiresIn: string }> {
    const hash = sha256(input.refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    const accessToken = await this.signAccessToken(session.userId, session.id);
    return { accessToken, expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m' };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const hash = sha256(input.token);
    const token = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Don't leak existence — always return 204 to caller, only actually create if user exists.
    if (!user || user.deletedAt) return;

    const token = generateToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + PASSWORD_TOKEN_TTL_MS),
      },
    });
    this.logger.log(
      `[dev] password reset for ${input.email}: http://localhost:5173/reset-password?token=${token}`,
    );
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hash = sha256(input.token);
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const passwordHash = await hashPassword(input.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      // Kill all live sessions — treat password reset as compromise recovery.
      this.prisma.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueSession(userId: string, meta: Meta): Promise<AuthResponse> {
    const refreshToken = generateToken(REFRESH_BYTES);
    const refreshTtlDays = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ip,
        expiresAt,
      },
    });

    const accessToken = await this.signAccessToken(userId, session.id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { org: true } } },
    });
    if (!user) throw new NotFoundException('User vanished mid-signup');

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: !!user.emailVerifiedAt,
      },
      memberships: user.memberships.map((m) => ({
        orgId: m.orgId,
        orgSlug: m.org.slug,
        orgName: m.org.name,
        role: m.role,
      })),
    };
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m',
      },
    );
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'org';
    let slug = base;
    let n = 0;
    // Collisions vanishingly unlikely in dev; loop is a safety net.
    while (await tx.organization.findUnique({ where: { slug } })) {
      n++;
      slug = `${base}-${n}`;
    }
    return slug;
  }
}
