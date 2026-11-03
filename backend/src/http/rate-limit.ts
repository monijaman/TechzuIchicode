import type { RequestHandler } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(maxRequests = 100, windowMs = 60_000): RequestHandler {
  return (request, response, next) => {
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader('RateLimit-Limit', maxRequests);
    response.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - bucket.count));
    if (bucket.count > maxRequests) {
      response.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
      return;
    }
    next();
  };
}
