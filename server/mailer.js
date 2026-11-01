import crypto from 'node:crypto';
import { db, nowISO } from './db.js';

/**
 * Mail transport.
 *
 * NutriLens ships without an SMTP account, so "sending" means:
 *   1. the message is always written to the server console, and
 *   2. it is stored in the `dev_outbox` table, which the client exposes as an
 *      in-app "dev mailbox" while DEV_MAILBOX is not 'off'.
 *
 * If you *do* have a mail provider, set MAIL_WEBHOOK_URL to an endpoint that
 * accepts `{ to, subject, text, html }` (Resend, Zapier, a Lambda, …) and the
 * same payload is POSTed there too, so the flow works unchanged in production.
 */
export const DEV_MAILBOX = String(process.env.DEV_MAILBOX || 'on').toLowerCase() !== 'off';

export const appUrl = () =>
  (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');

const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

/** Create a single-use token for `kind` ('verify' | 'reset') and return it raw. */
export function issueToken(userId, kind, ttlMinutes) {
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL').run(
    nowISO(),
    userId,
    kind
  );
  const raw = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  db.prepare(
    'INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, kind, hashToken(raw), expires, nowISO());
  return raw;
}

/** Validate a token without burning it. */
export function peekToken(raw, kind) {
  if (!raw) return null;
  const row = db
    .prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL')
    .get(hashToken(raw), kind);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

/** Validate and burn a token. */
export function consumeToken(raw, kind) {
  const row = peekToken(raw, kind);
  if (!row) return null;
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').run(nowISO(), row.id);
  return row;
}

export async function sendMail({ to, subject, text, link = null, kind = 'notice', includeLink = true }) {
  const createdAt = nowISO();
  const body = includeLink && link ? `${text}\n\n${link}\n\nThis link expires soon and can be used once.` : text;

  if (!DEV_MAILBOX) {
    db.prepare('DELETE FROM dev_outbox').run();
  }
  db.prepare(
    'INSERT INTO dev_outbox (to_email, subject, body, link, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(to, subject, body, link, kind, createdAt);

  console.log(`\n📮 [mail] to=${to} — ${subject}\n${body}\n`);

  const hook = process.env.MAIL_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body, html: body.replace(/\n/g, '<br>') }),
      });
    } catch (err) {
      console.warn('[mail] webhook failed:', err.message);
    }
  }
  return { ok: true };
}

export function outbox(limit = 20) {
  return db
    .prepare('SELECT * FROM dev_outbox ORDER BY id DESC LIMIT ?')
    .all(limit)
    .map((r) => ({
      id: r.id,
      to: r.to_email,
      subject: r.subject,
      body: r.body,
      link: r.link,
      kind: r.kind,
      createdAt: r.created_at,
    }));
}

export function clearOutbox() {
  db.prepare('DELETE FROM dev_outbox').run();
}
