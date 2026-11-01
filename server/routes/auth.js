import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, nowISO, J, rowToUser } from '../db.js';
import { signToken, requireAuth, publicUser } from '../auth.js';
import {
  DEV_MAILBOX, appUrl, issueToken, consumeToken, sendMail, outbox, clearOutbox,
} from '../mailer.js';

const router = express.Router();

const sanitize = (body) => ({
  name: String(body.name || '').trim(),
  email: String(body.email || '').trim().toLowerCase(),
  password: String(body.password || ''),
});

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const findByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
const findById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

const touchLogin = (id) => db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowISO(), id);

async function sendVerification(row) {
  const token = issueToken(row.id, 'verify', 60 * 24);
  const link = `${appUrl()}/verify?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: row.email,
    subject: 'Confirm your NutriLens email',
    text: `Hi ${row.name.split(' ')[0]},\n\nWelcome to NutriLens. Confirm this address to finish setting up your account.`,
    link,
    kind: 'verify',
  });
  return link;
}

// --- register / login -------------------------------------------------------
router.post('/register', async (req, res) => {
  const { name, email, password } = sanitize(req.body);
  if (!name || name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'That email address looks invalid.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  if (findByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });

  const conditions = Array.isArray(req.body.conditions) ? req.body.conditions : [];
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, age, sex, height_cm, weight_kg, activity, conditions, allergies, role, email_verified, provider, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'user', 0, 'password', ?, ?)`
    )
    .run(
      name, email, bcrypt.hashSync(password, 10),
      req.body.age || null, req.body.sex || null,
      req.body.heightCm || null, req.body.weightKg || null,
      req.body.activity || 'moderate', J.stringify(conditions), nowISO(), nowISO()
    );

  const row = findById(info.lastInsertRowid);
  const user = publicUser(rowToUser(row));
  let verification = { sent: false };
  try {
    await sendVerification(row);
    verification = { sent: true };
  } catch (err) {
    console.warn('[auth] could not queue verification mail:', err.message);
  }
  res.status(201).json({ token: signToken(user), user, verification });
});

router.post('/login', (req, res) => {
  const { email, password } = sanitize(req.body);
  const row = findByEmail(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  touchLogin(row.id);
  const user = publicUser(rowToUser(findById(row.id)));
  res.json({ token: signToken(user), user });
});

// --- profile -----------------------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/me', requireAuth, (req, res) => {
  const b = req.body || {};
  const current = req.user;
  const conditions = Array.isArray(b.conditions) ? b.conditions : current.conditions;
  const allergies = Array.isArray(b.allergies) ? b.allergies : current.allergies;
  db.prepare(
    `UPDATE users SET name = ?, age = ?, sex = ?, height_cm = ?, weight_kg = ?, activity = ?, conditions = ?, allergies = ? WHERE id = ?`
  ).run(
    String(b.name ?? current.name).trim() || current.name,
    b.age ?? current.age,
    b.sex ?? current.sex,
    b.heightCm ?? current.heightCm,
    b.weightKg ?? current.weightKg,
    b.activity ?? current.activity,
    J.stringify(conditions),
    J.stringify(allergies),
    current.id
  );
  const row = findById(current.id);
  res.json({ user: publicUser(rowToUser(row)) });
});

router.post('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const row = findById(req.user.id);
  if (!bcrypt.compareSync(String(currentPassword || ''), row.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  if (String(newPassword || '').length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(newPassword), 10), req.user.id);
  res.json({ ok: true });
});

// --- email verification ------------------------------------------------------
router.post('/verify-email', (req, res) => {
  const token = String(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'That confirmation link is missing its code.' });
  const row = consumeToken(token, 'verify');
  if (!row) {
    return res.status(400).json({ error: 'This confirmation link has expired or was already used. Request a new one.' });
  }
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
  const user = publicUser(rowToUser(findById(row.user_id)));
  res.json({ ok: true, user, message: `${user.email} is confirmed. Everything is unlocked.` });
});

router.post('/resend-verification', requireAuth, async (req, res) => {
  const row = findById(req.user.id);
  if (row.email_verified) return res.status(400).json({ error: 'This email is already confirmed.' });
  await sendVerification(row);
  res.json({ ok: true, message: `Confirmation link sent to ${row.email}.` });
});

// --- password reset ----------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'That email address looks invalid.' });

  const row = findByEmail(email);
  // Always answer the same way so the form cannot be used to probe accounts.
  const message = 'If that address has a NutriLens account, a reset link is on its way.';
  if (row) {
    const token = issueToken(row.id, 'reset', 60);
    const link = `${appUrl()}/reset?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: row.email,
      subject: 'Reset your NutriLens password',
      text: `Hi ${row.name.split(' ')[0]},\n\nUse the link below to choose a new password. If you didn't ask for this, you can ignore this email — nothing changes.`,
      link,
      kind: 'reset',
    });
  }
  res.json({ ok: true, message });
});

router.post('/reset-password', (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const row = consumeToken(token, 'reset');
  if (!row) return res.status(400).json({ error: 'This reset link has expired or was already used. Request a new one.' });

  // Choosing a new password proves control of the inbox, so confirm the email too.
  db.prepare('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?').run(
    bcrypt.hashSync(password, 10),
    row.user_id
  );
  const user = publicUser(rowToUser(findById(row.user_id)));
  res.json({ token: signToken(user), user, message: 'Password updated — you are signed in.' });
});

// --- dev mailbox -------------------------------------------------------------
router.get('/dev-mailbox', (req, res) => {
  if (!DEV_MAILBOX) return res.status(404).json({ error: 'Endpoint not found.' });
  res.json({ enabled: true, messages: outbox(20), transport: process.env.MAIL_WEBHOOK_URL ? 'webhook+dev' : 'dev' });
});

router.delete('/dev-mailbox', (req, res) => {
  if (!DEV_MAILBOX) return res.status(404).json({ error: 'Endpoint not found.' });
  clearOutbox();
  res.json({ ok: true });
});

// --- OAuth -------------------------------------------------------------------
const OAUTH = {
  google: {
    label: 'Google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
};

const configured = (provider) => {
  const p = OAUTH[provider];
  if (!p) return false;
  if (provider === 'google') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return false;
};

router.get('/oauth/providers', (req, res) => {
  res.json({
    providers: Object.entries(OAUTH).map(([key, p]) => ({
      key,
      label: p.label,
      configured: configured(key),
      demo: !configured(key),
    })),
    note: 'Without client credentials the button runs a local demo sign-in so the flow can still be tried end to end.',
  });
});

function upsertOAuthUser({ email, name, provider, avatarUrl, verified }) {
  const existing = findByEmail(email);
  if (existing) {
    db.prepare(
      'UPDATE users SET provider = ?, email_verified = ?, avatar_url = COALESCE(?, avatar_url), last_login_at = ? WHERE id = ?'
    ).run(provider, verified ? 1 : existing.email_verified, avatarUrl || null, nowISO(), existing.id);
    return { row: findById(existing.id), created: false };
  }
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, activity, conditions, allergies, role, email_verified, provider, avatar_url, created_at, last_login_at)
       VALUES (?, ?, ?, 'moderate', '[]', '[]', 'user', ?, ?, ?, ?, ?)`
    )
    .run(
      name || email.split('@')[0],
      email,
      bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10), // no password login for OAuth accounts
      verified ? 1 : 0,
      provider,
      avatarUrl || null,
      nowISO(),
      nowISO()
    );
  return { row: findById(info.lastInsertRowid), created: true };
}

router.get('/oauth/:provider', (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const p = OAUTH[provider];
  if (!p) return res.status(404).json({ error: 'Unknown sign-in provider.' });
  if (!configured(provider)) {
    return res.status(503).json({
      error: `${p.label} sign-in is not configured on this server.`,
      demo: true,
      hint: `Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use the demo ${p.label} sign-in.`,
    });
  }
  const state = crypto.randomBytes(16).toString('base64url');
  const redirectUri = `${appUrl()}/api/auth/oauth/${provider}/callback`;
  const url = new URL(p.authorize);
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', p.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  res.redirect(url.toString());
});

router.get('/oauth/:provider/callback', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const p = OAUTH[provider];
  const fail = (msg) => res.redirect(`/oauth/callback?error=${encodeURIComponent(msg)}`);
  if (!p || !configured(provider)) return fail('That provider is not configured.');
  const code = String(req.query.code || '');
  if (!code) return fail('Sign-in was cancelled.');

  try {
    const redirectUri = `${appUrl()}/api/auth/oauth/${provider}/callback`;
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch(p.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) return fail('Google rejected the sign-in. Please try again.');
    const { access_token: accessToken } = await tokenRes.json();
    const profileRes = await fetch(p.profile, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!profileRes.ok) return fail('Could not read your Google profile.');
    const profile = await profileRes.json();
    const email = String(profile.email || '').toLowerCase();
    if (!email) return fail('Google did not share an email address.');

    const { row, created } = upsertOAuthUser({
      email,
      name: profile.name,
      provider,
      avatarUrl: profile.picture,
      verified: Boolean(profile.email_verified),
    });
    if (created) {
      await sendMail({
        to: email,
        subject: 'Welcome to NutriLens',
        text: `Hi ${(profile.name || 'there').split(' ')[0]},\n\nYour NutriLens account was created with ${p.label} sign-in. Add your health profile to tailor the guidance.`,
        kind: 'notice',
        includeLink: false,
      });
    }
    const user = publicUser(rowToUser(row));
    res.redirect(`/oauth/callback?token=${encodeURIComponent(signToken(user))}`);
  } catch (err) {
    console.warn('[oauth] failed:', err.message);
    fail('Google sign-in failed. Please try again.');
  }
});

/**
 * Demo sign-in used when no OAuth credentials are present. It creates a normal
 * account (provider = google) so the multi-user and verification behaviour is
 * the same as a real OAuth user, and labels itself clearly in the UI.
 */
router.post('/oauth/demo', async (req, res) => {
  const provider = String(req.body?.provider || 'google').toLowerCase();
  const p = OAUTH[provider];
  if (!p) return res.status(404).json({ error: 'Unknown sign-in provider.' });

  const { row, created } = upsertOAuthUser({
    email: `riya.sharma@${provider}.demo.nutrilens.app`,
    name: 'Riya Sharma',
    provider,
    avatarUrl: null,
    verified: true,
  });
  touchLogin(row.id);
  const user = publicUser(rowToUser(findById(row.id)));
  res.json({
    token: signToken(user),
    user,
    created,
    demo: true,
    message: created
      ? `Signed in with the demo ${p.label} account — no credentials were used.`
      : `Signed in to the demo ${p.label} account.`,
  });
});

export default router;
