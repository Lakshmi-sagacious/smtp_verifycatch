import { z } from 'zod';

export const SignupSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  orgName: z.string().min(1).max(80),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(10),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export interface MembershipView {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;
}

export interface UserView {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserView;
  memberships: MembershipView[];
}

export interface MeResponse extends UserView {
  memberships: MembershipView[];
}
