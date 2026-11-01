/**
 * Runs automatically before `npm start` (see the "prestart" script).
 *
 * If the server's dependencies are missing — a fresh unzip, or an earlier
 * `npm install` that aborted (for example while trying to compile SQLite) —
 * this installs them first, then hands over to the real start script. So
 * `npm start` on a clean folder just works.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = ['express', 'jsonwebtoken', 'bcryptjs'];

const missing = (names) =>
  names.filter((name) => {
    try {
      require.resolve(name, { paths: [root] });
      return false;
    } catch {
      return true;
    }
  });

const absent = missing(REQUIRED);
if (!absent.length) process.exit(0);

console.log(`\n  NutriLens: ${absent.join(', ')} not found — installing dependencies first…\n`);

function npm(args) {
  const cli = process.env.npm_execpath; // set while npm runs a lifecycle script
  const result = cli
    ? spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' })
    : spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

let status = npm(['install', '--no-audit', '--no-fund']);
if (status !== 0) {
  console.log('\n  Retrying without the optional native SQLite module (Node 22.5+ has SQLite built in)…\n');
  status = npm(['install', '--no-audit', '--no-fund', '--omit=optional']);
}

if (status !== 0 || missing(REQUIRED).length) {
  console.error(
    [
      '\n  Could not install the server dependencies.',
      `  Open a terminal in ${root} and run:`,
      '      npm install',
      '  If that fails, paste the output — the usual cause is a company proxy or a locked node_modules folder.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

console.log('\n  Dependencies installed. Starting NutriLens…\n');
