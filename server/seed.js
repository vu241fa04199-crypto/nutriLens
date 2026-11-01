import bcrypt from 'bcryptjs';
import { db, nowISO, J, rowToProduct } from './db.js';
import { CATALOGUE, ALTERNATIVES, DEMO_USER, DEMO_PANTRY, DEMO_SCANS, DEMO_LOGS } from './seed-data.js';
import { analyze, quickScore, normalizeNutrition } from './analysis.js';

function scale(nutrition, portionG) {
  const per100 = normalizeNutrition(nutrition);
  const f = portionG / 100;
  const out = {};
  for (const [k, v] of Object.entries(per100)) {
    out[k] = k === 'sodium' ? Math.round(v * f) : Math.round(v * f * 10) / 10;
  }
  return out;
}

function dayStamp(daysAgo, hour = 13, minute = 20) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateKey(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const insertProduct = db.prepare(`
  INSERT INTO products (user_id, name, brand, category, serving_g, serving_label, nutrition, ingredients, additives, nova, emoji, notes, created_at, updated_at)
  VALUES (@user_id, @name, @brand, @category, @serving_g, @serving_label, @nutrition, @ingredients, @additives, @nova, @emoji, @notes, @created_at, @updated_at)
`);

const insertAlternative = db.prepare(`
  INSERT INTO alternatives (name, brand, category, description, swap_reason, nutrition, nova, tags, emoji, created_at)
  VALUES (@name, @brand, @category, @description, @swap_reason, @nutrition, @nova, @tags, @emoji, @created_at)
`);

const insertScan = db.prepare(`
  INSERT INTO scans (user_id, product_name, brand, category, portion_g, serving_g, nutrition, ingredients, additives, nova, score, verdict_key, verdict_label, result, notes, created_at)
  VALUES (@user_id, @product_name, @brand, @category, @portion_g, @serving_g, @nutrition, @ingredients, @additives, @nova, @score, @verdict_key, @verdict_label, @result, @notes, @created_at)
`);

const insertLog = db.prepare(`
  INSERT INTO intake_logs (user_id, log_date, meal, name, product_id, portion_g, nutrition, score, created_at)
  VALUES (@user_id, @log_date, @meal, @name, @product_id, @portion_g, @nutrition, @score, @created_at)
`);

export function seedCatalogue() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products WHERE user_id IS NULL').get().c;
  if (count > 0) return 0;
  const ts = nowISO();
  const tx = db.transaction(() => {
    for (const p of CATALOGUE) {
      insertProduct.run({
        user_id: null,
        name: p.name,
        brand: p.brand || '',
        category: p.category,
        serving_g: p.servingG,
        serving_label: p.servingLabel || `${p.servingG} g`,
        nutrition: J.stringify(p.nutrition),
        ingredients: p.ingredients || '',
        additives: J.stringify(p.additives || []),
        nova: p.nova ?? 4,
        emoji: p.emoji || '🍽️',
        notes: p.notes || '',
        created_at: ts,
        updated_at: ts,
      });
    }
    for (const a of ALTERNATIVES) {
      insertAlternative.run({
        name: a.name,
        brand: a.brand || '',
        category: a.category,
        description: a.description,
        swap_reason: a.swapReason,
        nutrition: J.stringify(a.nutrition),
        nova: a.nova ?? 2,
        tags: J.stringify(a.tags || []),
        emoji: a.emoji || '🥗',
        created_at: ts,
      });
    }
  });
  tx();
  return CATALOGUE.length;
}

export const TEAMMATE_USER = {
  name: 'Meera Iyer',
  email: 'meera@nutrilens.app',
  password: 'demo1234',
  age: 34,
  sex: 'female',
  heightCm: 163,
  weightKg: 68,
  activity: 'light',
  conditions: ['diabetes'],
  allergies: ['peanut'],
  verified: false,
};

export function seedDemoUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_USER.email);
  if (existing) return existing.id;

  const ts = nowISO();
  const hash = bcrypt.hashSync(DEMO_USER.password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, age, sex, height_cm, weight_kg, activity, conditions, allergies, role, email_verified, provider, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 1, 'password', ?, ?)`
    )
    .run(
      DEMO_USER.name, DEMO_USER.email, hash, DEMO_USER.age, DEMO_USER.sex,
      DEMO_USER.heightCm, DEMO_USER.weightKg, DEMO_USER.activity,
      J.stringify(DEMO_USER.conditions), J.stringify(DEMO_USER.allergies), ts, ts
    );
  const userId = info.lastInsertRowid;

  const tx = db.transaction(() => {
    // --- pantry
    for (const [i, p] of DEMO_PANTRY.entries()) {
      insertProduct.run({
        user_id: userId,
        name: p.name,
        brand: p.brand || '',
        category: p.category,
        serving_g: p.servingG,
        serving_label: p.servingLabel || `${p.servingG} g`,
        nutrition: J.stringify(p.nutrition),
        ingredients: p.ingredients || '',
        additives: J.stringify(p.additives || []),
        nova: p.nova ?? 4,
        emoji: p.emoji || '🍽️',
        notes: p.notes || '',
        created_at: dayStamp(20 - i),
        updated_at: dayStamp(20 - i),
      });
    }

    // name -> product row (catalogue + pantry)
    const lookup = new Map();
    for (const row of db.prepare('SELECT * FROM products').all()) {
      const prod = rowToProduct(row);
      lookup.set(prod.name, prod);
    }

    // --- scans
    for (const [name, portionG, daysAgo, note] of DEMO_SCANS) {
      const prod = lookup.get(name);
      if (!prod) continue;
      const result = analyze({
        nutrition: prod.nutrition,
        portionG,
        servingG: prod.servingG,
        ingredients: prod.ingredients,
        additives: prod.additives,
        nova: prod.nova,
        user: { conditions: DEMO_USER.conditions },
      });
      insertScan.run({
        user_id: userId,
        product_name: prod.name,
        brand: prod.brand,
        category: prod.category,
        portion_g: portionG,
        serving_g: prod.servingG,
        nutrition: J.stringify(prod.nutrition),
        ingredients: prod.ingredients,
        additives: J.stringify(prod.additives),
        nova: prod.nova,
        score: result.score,
        verdict_key: result.verdict.key,
        verdict_label: result.verdict.label,
        result: J.stringify(result),
        notes: note || '',
        created_at: dayStamp(daysAgo, 9 + ((daysAgo * 3) % 12), (daysAgo * 7) % 60),
      });
    }

    // --- intake logs
    for (const [name, portionG, meal, daysAgo] of DEMO_LOGS) {
      const prod = lookup.get(name);
      const nutrition = prod ? scale(prod.nutrition, portionG) : scale({ kcal: 250, protein: 8, carbs: 30, sugar: 5, fiber: 3, fat: 8, satfat: 2, sodium: 300 }, portionG);
      const q = prod ? quickScore(prod.nutrition, prod.nova, prod.additives) : { score: 40 };
      insertLog.run({
        user_id: userId,
        log_date: dateKey(daysAgo),
        meal,
        name,
        product_id: prod && !prod.isCatalogue ? prod.id : null,
        portion_g: portionG,
        nutrition: J.stringify(nutrition),
        score: q.score,
        created_at: dayStamp(daysAgo, meal === 'breakfast' ? 8 : meal === 'lunch' ? 13 : meal === 'dinner' ? 21 : 17),
      });
    }
  });
  tx();
  return userId;
}

export function isSeeded() {
  const u = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const p = db.prepare('SELECT COUNT(*) AS c FROM products WHERE user_id IS NULL').get().c;
  return u > 0 && p > 0;
}

/**
 * The demo account is the workspace admin, and a second ordinary account exists
 * so the admin screen, the verification banner and role changes can all be
 * exercised. Runs on every boot; every statement is a no-op once applied.
 */
export function ensureDemoRoles() {
  const demo = db.prepare('SELECT * FROM users WHERE email = ?').get(DEMO_USER.email);
  if (demo && (demo.role !== 'admin' || !demo.email_verified)) {
    db.prepare("UPDATE users SET role = 'admin', email_verified = 1 WHERE id = ?").run(demo.id);
  }
  const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;
  if (!admins) {
    const first = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
    if (first) db.prepare("UPDATE users SET role = 'admin', email_verified = 1 WHERE id = ?").run(first.id);
  }

  const demoEnabled = String(process.env.SEED_DEMO ?? 'on').toLowerCase() !== 'off';
  if (demoEnabled && !db.prepare('SELECT id FROM users WHERE email = ?').get(TEAMMATE_USER.email)) {
    db.prepare(
      `INSERT INTO users (name, email, password_hash, age, sex, height_cm, weight_kg, activity, conditions, allergies, role, email_verified, provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, 'password', ?)`
    ).run(
      TEAMMATE_USER.name, TEAMMATE_USER.email, bcrypt.hashSync(TEAMMATE_USER.password, 10),
      TEAMMATE_USER.age, TEAMMATE_USER.sex, TEAMMATE_USER.heightCm, TEAMMATE_USER.weightKg,
      TEAMMATE_USER.activity, J.stringify(TEAMMATE_USER.conditions), J.stringify(TEAMMATE_USER.allergies),
      TEAMMATE_USER.verified ? 1 : 0, dayStamp(9)
    );
  }
  return true;
}

export function seedIfEmpty() {
  seedCatalogue(); // the shared food catalogue / swaps are not demo data — always seed
  const demoEnabled = String(process.env.SEED_DEMO ?? 'on').toLowerCase() !== 'off';
  const id = demoEnabled ? seedDemoUser() : null;
  ensureDemoRoles();
  if (!demoEnabled) {
    const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    console.log(`SEED_DEMO=off — no demo accounts created (${users} real account(s); the first one becomes admin).`);
  }
  return id;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  if (process.argv.includes('--force')) {
    db.exec('DELETE FROM intake_logs; DELETE FROM scans; DELETE FROM products; DELETE FROM alternatives; DELETE FROM users;');
    console.log('Cleared existing data.');
  }
  seedCatalogue();
  const id = seedDemoUser();
  ensureDemoRoles();
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
    scans: db.prepare('SELECT COUNT(*) c FROM scans').get().c,
    logs: db.prepare('SELECT COUNT(*) c FROM intake_logs').get().c,
    alternatives: db.prepare('SELECT COUNT(*) c FROM alternatives').get().c,
  };
  console.log('Seed complete. Demo user id:', id, counts);
}
