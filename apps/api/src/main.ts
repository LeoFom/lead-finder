import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Module({})
class AppModule {}

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
