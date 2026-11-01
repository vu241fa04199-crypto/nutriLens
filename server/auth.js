import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db, rowToUser, DATA_DIR } from './db.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    try {
      fs.writeFileSync(file, secret, { mode: 0o600 });
    } catch {
      /* ephemeral fallback */
    }
    return secret;
  }
}

export const JWT_SECRET = loadSecret();

export const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!row) return res.status(401).json({ error: 'Session expired — please sign in again.' });
    req.user = rowToUser(row);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admins can open this page.' });
    }
    next();
  });
}

export function publicUser(user) {
  return { ...user, initials: initialsOf(user.name) };
}

function initialsOf(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}
