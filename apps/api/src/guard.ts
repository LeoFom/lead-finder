import { Injectable, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { PrismaClient } from '@lead-finder/db';
import type { OwnerRequest } from './security.js';
import { equal, hash, sessionToken } from './security.js';
import { config } from './config.js';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(@Inject('DB') private readonly db: PrismaClient) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<OwnerRequest>();
    if (req.path.startsWith('/api/v1/health/')) return true;
    if (!equal(String(req.headers['x-api-proxy-key'] ?? ''), config.proxyKey))
      throw new UnauthorizedException();
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !config.origins.includes(String(req.headers.origin ?? ''))
    )
      throw new ForbiddenException('Недозволене походження запиту');
    if (['/api/v1/auth/login', '/api/v1/auth/setup', '/api/v1/auth/status'].includes(req.path))
      return true;
    const token = sessionToken(req);
    const session =
      token && (await this.db.session.findUnique({ where: { tokenHash: hash(token) } }));
    if (!session || session.expiresAt <= new Date())
      throw new UnauthorizedException('Увійдіть у свій простір');
    req.ownerId = session.userId;
    return true;
  }
}
