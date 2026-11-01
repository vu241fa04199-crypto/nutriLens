/**
 * `npm run doctor` — prints exactly what is (and isn't) ready to run NutriLens.
 * Useful when the browser says "localhost refused to connect".
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/sqlite.js';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4000;

const rows = [];
const pass = (label, detail = '') => rows.push({ ok: true, label, detail });
const fail = (label, detail = '', fix = '') => rows.push({ ok: false, label, detail, fix });
const info = (label, detail = '') => rows.push({ ok: null, label, detail });

// 1. Node
const major = Number(process.versions.node.split('.')[0]);
const minor = Number(process.versions.node.split('.')[1]);
if (major > 22 || (major === 22 && minor >= 5)) {
  pass(`Node ${process.version}`, 'has the built-in SQLite module — nothing to compile');
} else if (major >= 18) {
  info(`Node ${process.version}`, 'works, but Node 22.5+ or newer avoids the native build entirely');
} else {
  fail(`Node ${process.version}`, 'too old', 'Install Node 22 LTS or newer from https://nodejs.org');
}
info('Platform', `${process.platform} ${process.arch}`);

// 2. Dependencies
const deps = ['express', 'jsonwebtoken', 'bcryptjs'];
const missingDeps = deps.filter((d) => {
  try {
    require.resolve(d, { paths: [root] });
    return false;
  } catch {
    return true;
  }
});
if (missingDeps.length) {
  fail('Server dependencies', `missing: ${missingDeps.join(', ')}`, 'Run: npm install');
} else {
  pass('Server dependencies', 'express, jsonwebtoken, bcryptjs present');
}

// 3. SQLite driver
if (!missingDeps.length) {
  try {
    const { driver } = openDatabase(path.join(root, 'data', '.doctor-probe.db'));
    fs.rmSync(path.join(root, 'data', '.doctor-probe.db'), { force: true });
    pass('SQLite driver', driver);
  } catch (err) {
    fail('SQLite driver', String(err.message || err).split('\n')[0], 'Use Node 22.5+ (built-in SQLite)');
  }
}

// 4. Built client
const distIndex = path.join(root, 'client', 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  pass('Built client', 'client/dist/index.html found');
} else {
  fail('Built client', 'client/dist is missing', 'Run: npm run build');
}

// 5. Data folder writable
try {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', '.doctor'), 'ok');
  fs.rmSync(path.join(root, 'data', '.doctor'));
  pass('Data folder', path.join(root, 'data'));
} catch (err) {
  fail('Data folder', String(err.message || err), 'Check folder permissions / antivirus');
}

// 6. Free port
const portFree = await new Promise((resolve) => {
  const srv = net.createServer();
  srv.once('error', (e) => resolve(e.code === 'EADDRINUSE' ? false : true));
  srv.once('listening', () => srv.close(() => resolve(true)));
  srv.listen(PORT, '0.0.0.0');
});
if (portFree) {
  pass(`Port ${PORT}`, 'free — the server can start');
} else {
  info(`Port ${PORT}`, 'already in use');
  rows[rows.length - 1].fix =
    `If NutriLens is not already open in your browser, something else owns the port — start on another one: set PORT=4001 && npm start  (macOS/Linux: PORT=4001 npm start)`;
}

// --- report ---------------------------------------------------------------
const line = '─'.repeat(64);
console.log(`\n${line}\n  NutriLens health check\n${line}`);
for (const r of rows) {
  const mark = r.ok === null ? '•' : r.ok ? '✓' : '✕';
  console.log(`  ${mark} ${r.label.padEnd(22)} ${r.detail}`);
  if (r.fix) console.log(`    ${' '.repeat(2)}→ ${r.fix}`);
}
console.log(line);

const problems = rows.filter((r) => r.ok === false);
const notes = rows.filter((r) => r.ok === null);
if (problems.length) {
  console.log(`  ${problems.length} problem(s) above — fix them, then run: npm start\n${line}\n`);
} else {
  console.log(
    `  Ready to run.\n\n  Start it with:   npm start\n  Then open:       http://localhost:${PORT}\n  Demo login:      demo@nutrilens.app / demo1234\n${notes.length ? `\n  Note: ${notes.length} item(s) marked • above (not fatal).\n` : ''}${line}\n`
  );
}
