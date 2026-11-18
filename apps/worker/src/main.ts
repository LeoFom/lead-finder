import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { once } from 'node:events';

@Module({})
class WorkerModule {}

const app = await NestFactory.createApplicationContext(WorkerModule);
Logger.log('Worker initialized. No job consumers configured.', 'Worker');
// An idle phase-1 worker has no queue socket to hold the event loop open.
const keepAlive = setInterval(() => {}, 2 ** 30);
await Promise.race([once(process, 'SIGINT'), once(process, 'SIGTERM')]);
clearInterval(keepAlive);
await app.close();
