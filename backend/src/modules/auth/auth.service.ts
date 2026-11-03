import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

const scrypt = promisify(scryptCallback);
const accessLifetimeSeconds = 15 * 60;
const refreshLifetimeSeconds = 30 * 24 * 60 * 60;

type AccessClaims = { sub: string; companyId: string; outletId?: string; role: 'HQ' | 'OUTLET'; type: 'access'; exp: number };
type RefreshClaims = Omit<AccessClaims, 'type' | 'exp'> & { jti: string; type: 'refresh'; exp: number };

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const parseBase64url = (value: string) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;

function secret(kind: 'access' | 'refresh'): string {
  const configured = kind === 'access' ? process.env.JWT_ACCESS_SECRET : process.env.JWT_REFRESH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error(`JWT_${kind.toUpperCase()}_SECRET is required`);
  return `development-only-${kind}-secret-change-me`;
}

function sign(payload: object, kind: 'access' | 'refresh'): string {
  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret(kind)).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function verify(token: string, kind: 'access' | 'refresh'): Record<string, unknown> {
  const [header, payload, signature, extra] = token.split('.');
  if (!header || !payload || !signature || extra) throw new AppError(401, 'INVALID_TOKEN', 'Invalid bearer token');
  const expected = createHmac('sha256', secret(kind)).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid bearer token');
  }
  const claims = parseBase64url(payload);
  if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Bearer token has expired');
  }
  return claims;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueTokens(user: { id: string; companyId: string; outletId: string | null; role: 'HQ' | 'OUTLET' }) {
  const now = Math.floor(Date.now() / 1000);
  const accessClaims: AccessClaims = {
    sub: user.id, companyId: user.companyId, ...(user.outletId && { outletId: user.outletId }), role: user.role, type: 'access', exp: now + accessLifetimeSeconds
  };
  const refreshId = randomBytes(16).toString('hex');
  const refreshClaims: RefreshClaims = { ...accessClaims, jti: refreshId, type: 'refresh', exp: now + refreshLifetimeSeconds };
  const accessToken = sign(accessClaims, 'access');
  const refreshToken = sign(refreshClaims, 'refresh');
  await prisma.refreshToken.create({
    data: { id: refreshId, userId: user.id, tokenHash: tokenHash(refreshToken), expiresAt: new Date(refreshClaims.exp * 1000) }
  });
  return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: accessLifetimeSeconds };
}

export async function registerHq(email: string, password: string, companyName: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const result = await prisma.company.create({
    data: { name: companyName, users: { create: { email: normalizedEmail, passwordHash, role: 'HQ' } } },
    include: { users: true }
  });
  const user = result.users[0];
  return { company: { id: result.id, name: result.name }, user: { id: user.id, email: user.email, role: user.role, companyId: user.companyId, outletId: user.outletId }, tokens: await issueTokens(user) };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  return { user: { id: user.id, email: user.email, role: user.role, companyId: user.companyId, outletId: user.outletId }, tokens: await issueTokens(user) };
}

export async function createUser(companyId: string, email: string, password: string, role: 'HQ' | 'OUTLET', outletId?: string) {
  if (role === 'OUTLET') {
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { companyId: true } });
    if (!outlet || outlet.companyId !== companyId) throw new AppError(404, 'NOT_FOUND', 'Outlet was not found for this company');
  }
  const user = await prisma.user.create({ data: { companyId, email: email.trim().toLowerCase(), passwordHash: await hashPassword(password), role, outletId } });
  return { id: user.id, email: user.email, role: user.role, outletId: user.outletId };
}

export async function refresh(refreshToken: string) {
  const claims = verify(refreshToken, 'refresh');
  if (claims.type !== 'refresh' || typeof claims.sub !== 'string' || typeof claims.jti !== 'string') {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
  }
  const stored = await prisma.refreshToken.findUnique({ where: { id: claims.jti }, include: { user: true } });
  if (!stored || stored.userId !== claims.sub || stored.revokedAt || stored.expiresAt <= new Date() || stored.tokenHash !== tokenHash(refreshToken) || !stored.user.isActive) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
  }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return { user: { id: stored.user.id, email: stored.user.email, role: stored.user.role, companyId: stored.user.companyId, outletId: stored.user.outletId }, tokens: await issueTokens(stored.user) };
}

export function authenticateAccessToken(token: string): AccessClaims {
  const claims = verify(token, 'access');
  if (claims.type !== 'access' || typeof claims.sub !== 'string' || typeof claims.companyId !== 'string' || (claims.role !== 'HQ' && claims.role !== 'OUTLET')) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
  }
  return { sub: claims.sub, companyId: claims.companyId, ...(typeof claims.outletId === 'string' && { outletId: claims.outletId }), role: claims.role, type: 'access', exp: claims.exp as number };
}
