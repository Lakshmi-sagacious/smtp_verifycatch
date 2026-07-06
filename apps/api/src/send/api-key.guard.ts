import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeysService } from '../api-keys/api-keys.service';

export interface ApiKeyContext {
  keyId: string;
  orgId: string;
  scopes: string[];
}

// Reads X-API-Key header. Distinct header (not Authorization) so we don't confuse it with JWT.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { apiKey?: ApiKeyContext }>();
    const raw = req.headers['x-api-key'];
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (!key) throw new UnauthorizedException('Missing X-API-Key header');

    const row = await this.apiKeys.findByKey(key);
    if (!row) throw new UnauthorizedException('Invalid or revoked API key');

    req.apiKey = { keyId: row.id, orgId: row.orgId, scopes: row.scopes };
    // Fire-and-forget touch — don't block the request.
    void this.apiKeys.markUsed(row.id);
    return true;
  }
}
