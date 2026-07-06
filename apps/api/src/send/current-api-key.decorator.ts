import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiKeyContext } from './api-key.guard';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const req = ctx.switchToHttp().getRequest<{ apiKey?: ApiKeyContext }>();
    if (!req.apiKey) throw new Error('CurrentApiKey used without ApiKeyGuard');
    return req.apiKey;
  },
);
