import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
function derive(
  password: string,
  salt: string,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
}
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('hex');
export const equal = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = (await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  const expectedBytes = Buffer.from(expected, 'hex');
  return expectedBytes.length === actual.length && timingSafeEqual(expectedBytes, actual);
}
export function parse<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException({
      code: 'INVALID_INPUT',
      message: 'Перевірте введені дані',
      fieldErrors: result.error.flatten().fieldErrors,
    });
  return result.data;
}
export function sessionToken(req: Request) {
  return (
    req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('lf_session='))
      ?.slice('lf_session='.length) ?? ''
  );
}
export interface OwnerRequest extends Request {
  ownerId: string;
}
