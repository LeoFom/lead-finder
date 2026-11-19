import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Inject,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import type { PrismaClient } from '@lead-finder/db';
import { z } from 'zod';
import { config } from './config.js';
import {
  equal,
  hash,
  hashPassword,
  opaqueToken,
  parse,
  sessionToken,
  verifyPassword,
} from './security.js';
import type { OwnerRequest } from './security.js';

const credentials = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
@Controller('auth')
export class AuthController {
  constructor(@Inject('DB') private readonly db: PrismaClient) {}
  @Get('status')
  async status() {
    return { setupRequired: (await this.db.user.count()) === 0 };
  }

  private async limit(req: OwnerRequest) {
    const key = hash(String(req.headers['x-client-ip'] ?? req.ip));
    const now = new Date();
    await this.db.loginAttempt.deleteMany({
      where: { key, windowStart: { lt: new Date(now.getTime() - 15 * 60 * 1000) } },
    });
    const attempt = await this.db.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (attempt.count > 8)
      throw new HttpException('Забагато спроб. Спробуйте через 15 хвилин.', 429);
  }
  private async issue(userId: string, res: Response) {
    const token = opaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await this.db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.db.session.create({ data: { tokenHash: hash(token), userId, expiresAt } });
    res.cookie('lf_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    return { authenticated: true };
  }
  @Post('setup')
  async setup(
    @Body() body: unknown,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.limit(req);
    const input = parse(credentials.extend({ token: z.string().max(256) }), body);
    if (!equal(input.token, config.setupToken))
      throw new UnauthorizedException('Некоректний код налаштування');
    const passwordHash = await hashPassword(input.password);
    const user = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(524102)`;
      if (await tx.user.count()) throw new ConflictException('Власника вже налаштовано');
      return tx.user.create({ data: { email: input.email, passwordHash } });
    });
    return this.issue(user.id, res);
  }
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.limit(req);
    const input = parse(credentials, body);
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const fallback = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
    if (!(await verifyPassword(input.password, user?.passwordHash ?? fallback)) || !user)
      throw new UnauthorizedException('Некоректна пошта або пароль');
    return this.issue(user.id, res);
  }
  @Get('me')
  async me(@Req() req: OwnerRequest) {
    return this.db.user.findUnique({
      where: { id: req.ownerId },
      select: { id: true, email: true, role: true },
    });
  }
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: OwnerRequest, @Res({ passthrough: true }) res: Response) {
    await this.db.session.deleteMany({ where: { tokenHash: hash(sessionToken(req)) } });
    res.clearCookie('lf_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { authenticated: false };
  }
}
