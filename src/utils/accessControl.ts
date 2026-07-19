import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const ACCESS_COOKIE = 'anquandian_access';
const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60;

type AccessConfig = {
  inviteCodes: Set<string>;
  cookieSecret: string;
  requireAccess: boolean;
};

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

export const getAccessConfig = (): AccessConfig => {
  const inviteCodes = new Set(
    (process.env.INVITE_CODES || '')
      .split(',')
      .map(code => code.trim())
      .filter(Boolean),
  );
  const requireAccess = inviteCodes.size > 0 || process.env.NODE_ENV === 'production';
  return {
    inviteCodes,
    cookieSecret: process.env.ACCESS_COOKIE_SECRET || '',
    requireAccess,
  };
};

const signInviteCode = (inviteCode: string, secret: string) => {
  return crypto.createHmac('sha256', secret).update(inviteCode).digest('base64url');
};

const createAccessToken = (inviteCode: string, secret: string) => {
  const encodedCode = Buffer.from(inviteCode, 'utf8').toString('base64url');
  return `${encodedCode}.${signInviteCode(inviteCode, secret)}`;
};

const readCookie = (req: Request, name: string) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split(';').map(part => part.trim());
  const prefix = `${name}=`;
  const found = cookies.find(part => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : '';
};

const verifyAccessToken = (token: string, config: AccessConfig) => {
  if (!token || !token.includes('.') || !config.cookieSecret) return '';
  const [encodedCode, signature] = token.split('.');
  const inviteCode = Buffer.from(encodedCode, 'base64url').toString('utf8');
  if (!config.inviteCodes.has(inviteCode)) return '';

  const expected = signInviteCode(inviteCode, config.cookieSecret);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (signatureBytes.length !== expectedBytes.length) return '';
  return crypto.timingSafeEqual(signatureBytes, expectedBytes) ? inviteCode : '';
};

export const readAccessInviteCode = (req: Request, config = getAccessConfig()) => {
  if (!config.requireAccess) return 'local';
  return verifyAccessToken(readCookie(req, ACCESS_COOKIE), config);
};

export const handleInvite = (req: Request, res: Response, next: NextFunction) => {
  const invite = typeof req.query.invite === 'string' ? req.query.invite.trim() : '';
  if (!invite) {
    next();
    return;
  }

  const config = getAccessConfig();
  if (!config.cookieSecret || !config.inviteCodes.has(invite)) {
    res.status(401).send('邀请码无效或已失效，请联系管理员获取新的访问链接。');
    return;
  }

  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(ACCESS_COOKIE, createAccessToken(invite, config.cookieSecret), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ONE_MONTH_SECONDS * 1000,
    path: '/',
  });

  const redirectUrl = new URL(req.originalUrl, 'http://localhost');
  redirectUrl.searchParams.delete('invite');
  res.redirect(302, `${redirectUrl.pathname}${redirectUrl.search || ''}`);
};

export const requireApiAccess = (req: Request, res: Response, next: NextFunction) => {
  const config = getAccessConfig();
  if (!config.requireAccess) {
    next();
    return;
  }
  if (!config.cookieSecret || config.inviteCodes.size === 0) {
    res.status(503).json({ error: 'Access control is not configured' });
    return;
  }
  const inviteCode = readAccessInviteCode(req, config);
  if (!inviteCode) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.locals.inviteCode = inviteCode;
  next();
};

export const requirePageAccess = (req: Request, res: Response, next: NextFunction) => {
  const config = getAccessConfig();
  if (!config.requireAccess || req.path.startsWith('/api') || req.path.includes('.')) {
    next();
    return;
  }
  if (readAccessInviteCode(req, config)) {
    next();
    return;
  }
  res.status(401).send('请使用管理员发送的邀请码链接访问。');
};

export const createRateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = getAccessConfig();
    const inviteCode = readAccessInviteCode(req, config) || req.ip || 'anonymous';
    const key = `${req.path}:${inviteCode}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (bucket.count >= options.maxRequests) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }
    bucket.count += 1;
    next();
  };
};
