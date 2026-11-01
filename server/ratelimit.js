/**
 * Tiny in-memory rate limiter — enough to stop someone hammering the login,
 * registration or password-reset endpoints from one address.
 *
 * Single-process only (fine for one Node instance); if you ever run several,
 * move this to Redis or a gateway.
 */
const buckets = new Map();

export function rateLimit({ windowMs = 10 * 60_000, max = 20, message = 'Too many attempts. Wait a few minutes and try again.' } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}|${req.baseUrl}${req.path}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

    if (hits.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    hits.push(now);
    buckets.set(key, hits);

    // keep the map from growing forever
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
      }
    }
    next();
  };
}
