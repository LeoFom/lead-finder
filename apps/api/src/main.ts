import 'reflect-metadata';
import { Module, Catch, HttpException } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@lead-finder/db';
import { config } from './config.js';
import { AccessGuard } from './guard.js';
import { AuthController } from './auth.js';
import { LeadController } from './leads.js';

const db = createDatabase(config.databaseUrl);
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const value =
      error instanceof HttpException ? error.getResponse() : { message: 'Серверна помилка' };
    const requestId = randomUUID();
    if (status === 500) console.error(JSON.stringify({ requestId, code: 'INTERNAL_ERROR' }));
    response
      .status(status)
      .json({ ...(typeof value === 'string' ? { message: value } : value), status, requestId });
  }
}
@Module({
  controllers: [AuthController, LeadController],
  providers: [
    { provide: 'DB', useValue: db },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
class AppModule {}

const app = await NestFactory.create(AppModule, { bodyParser: true });
app.setGlobalPrefix('api/v1');
app.use(helmet());
app.useGlobalFilters(new Errors());
app.enableShutdownHooks();
await db.$connect();
process.once('SIGTERM', () => {
  void db.$disconnect();
});
process.once('SIGINT', () => {
  void db.$disconnect();
});
await app.listen(config.port, '0.0.0.0');
