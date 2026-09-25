import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'db', 'ticketqr.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verify));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

export function createSession(
  userId: number,
  orgId: number | null,
  role: string,
  name: string,
  email: string
): string {
  const db = getDb();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare(
    'INSERT INTO sessions (id, user_id, org_id, role, name, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(token, userId, orgId, role, name, email, now.toISOString(), expiresAt.toISOString());

  return token;
}

export function getSuperAdminCount(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'")
    .get() as { count: number };
  return row.count;
}

export function createUser(params: {
  orgId: number | null;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'scanner';
  createdBy: number | null;
}): { success: boolean; userId?: number; error?: string } {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(params.email);
  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  const passwordHash = hashPassword(params.password);
  const info = db
    .prepare(
      'INSERT INTO users (org_id, name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      params.orgId,
      params.name,
      params.email,
      passwordHash,
      params.role,
      'active',
      new Date().toISOString()
    );

  return { success: true, userId: info.lastInsertRowid as number };
}

export function getSession(token: string | undefined): {
  id: number;
  orgId: number | null;
  role: string;
  name: string;
  email: string;
} | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT user_id as id, org_id as orgId, role, name, email FROM sessions WHERE id = ? AND expires_at > datetime('now')`
    )
    .get(token) as
    { id: number; orgId: number | null; role: string; name: string; email: string } | undefined;

  return row ?? null;
}

export function destroySession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  plan_id INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'cancelled')),
  max_events INTEGER DEFAULT 10,
  max_tickets INTEGER DEFAULT 1000,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly')),
  max_events INTEGER DEFAULT 10,
  max_tickets INTEGER DEFAULT 1000,
  features TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK(role IN ('super_admin', 'admin', 'scanner')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  billing_cycle TEXT DEFAULT 'monthly',
  starts_at TEXT,
  ends_at TEXT,
  cancelled_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id),
  invoice_number TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'failed', 'cancelled')),
  issue_date TEXT DEFAULT (datetime('now')),
  due_date TEXT,
  paid_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_date TEXT,
  venue TEXT,
  poster_image TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  page_size TEXT DEFAULT 'A4',
  background_image TEXT,
  config TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'valid' CHECK(status IN ('valid', 'used', 'invalid')),
  scanned_at TEXT,
  scanned_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id),
  event_id INTEGER REFERENCES events(id),
  qr_data TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('valid', 'used', 'invalid')),
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_token ON tickets(qr_token);
CREATE INDEX IF NOT EXISTS idx_tickets_serial ON tickets(serial_number);
CREATE INDEX IF NOT EXISTS idx_tickets_scanned_at ON tickets(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket_id ON scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_created_at ON scan_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_org_id ON billing(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_number ON billing(invoice_number);
CREATE INDEX IF NOT EXISTS idx_ticket_designs_event_id ON ticket_designs(event_id);
`;

export function initDatabase(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  seedDatabase(db);
}

function runMigrations(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(events)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'poster_image')) {
    db.exec('ALTER TABLE events ADD COLUMN poster_image TEXT');
  }
}

function seedPlans(db: Database.Database): number[] {
  const existingPlans = db.prepare('SELECT id FROM plans ORDER BY id').all() as { id: number }[];
  if (existingPlans.length > 0) return existingPlans.map((plan) => plan.id);

  const insertPlan = db.prepare(
    'INSERT INTO plans (name, description, price_cents, currency, billing_cycle, max_events, max_tickets, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const plans = [
    ['Free', 'Basic ticket scanning for small events', 0, 'monthly', 5, 100],
    ['Starter', 'For growing event organizers', 4900, 'monthly', 20, 2000],
    ['Professional', 'For large-scale events', 14900, 'monthly', 100, 20000],
    ['Enterprise', 'Unlimited events and tickets', 49900, 'monthly', -1, -1],
  ];

  return plans.map((plan) => {
    const info = insertPlan.run(plan[0], plan[1], plan[2], 'USD', plan[3], plan[4], plan[5], '{}');
    return info.lastInsertRowid as number;
  });
}

function seedDatabase(db: Database.Database): void {
  const planIds = seedPlans(db);
  const check = db.prepare('SELECT COUNT(*) as count FROM organizations').get() as {
    count: number;
  };
  if (check.count > 0 || process.env.NODE_ENV === 'production') return;

  const insertOrg = db.prepare(
    'INSERT INTO organizations (name, plan_id, status, max_events, max_tickets) VALUES (?, ?, ?, ?, ?)'
  );
  const insertUser = db.prepare(
    'INSERT INTO users (org_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertEvent = db.prepare(
    'INSERT INTO events (org_id, name, description, event_date, venue, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertTicket = db.prepare(
    'INSERT INTO tickets (event_id, serial_number, qr_token, status) VALUES (?, ?, ?, ?)'
  );

  const orgs = [
    { name: 'Summer Gala Events', planIdx: 3, events: 20, tickets: 5000, status: 'active' },
    { name: 'TechCon Organizers', planIdx: 2, events: 10, tickets: 2000, status: 'active' },
    { name: 'City Festival Co', planIdx: 1, events: 5, tickets: 500, status: 'active' },
  ];

  const orgIds: number[] = [];
  for (const org of orgs) {
    const info = insertOrg.run(org.name, planIds[org.planIdx], org.status, org.events, org.tickets);
    orgIds.push(info.lastInsertRowid as number);
  }

  const users = [
    {
      orgId: orgIds[0],
      name: 'Alex Harmon',
      email: 'admin@ticketqr.io',
      role: 'admin',
      status: 'active',
    },
    {
      orgId: orgIds[0],
      name: 'Sam Torres',
      email: 'staff@ticketqr.io',
      role: 'scanner',
      status: 'active',
    },
    {
      orgId: orgIds[1],
      name: 'Nina Patel',
      email: 'nina@techcon.io',
      role: 'admin',
      status: 'active',
    },
    {
      orgId: orgIds[1],
      name: 'Ravi Chen',
      email: 'ravi@techcon.io',
      role: 'scanner',
      status: 'active',
    },
    {
      orgId: null,
      name: 'Super Admin',
      email: 'superadmin@ticketqr.io',
      role: 'super_admin',
      status: 'active',
    },
  ];

  for (const user of users) {
    insertUser.run(
      user.orgId,
      user.name,
      user.email,
      hashPassword('Admin@2026'),
      user.role,
      user.status
    );
  }

  const eventInfo = insertEvent.run(
    orgIds[0],
    'Summer Gala 2026',
    'Annual charity gala fundraiser',
    '2026-08-16',
    'Grand Ballroom, City Center',
    'active'
  );
  const eventId = eventInfo.lastInsertRowid as number;

  const serials = [];
  for (let i = 1; i <= 20; i++) {
    serials.push({
      serial: `EVT-2026-${String(i).padStart(4, '0')}`,
      token: `TICKETQR:EVT-2026-${String(i).padStart(4, '0')}:EVT-2026-SUMMER-GALA`,
      status: i === 3 ? 'used' : 'valid',
    });
  }

  for (const s of serials) {
    insertTicket.run(eventId, s.serial, s.token, s.status);
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default {
  getDb,
  hashPassword,
  verifyPassword,
  generateToken,
  initDatabase,
  closeDatabase,
  getSuperAdminCount,
  createUser,
};
