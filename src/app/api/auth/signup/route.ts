import { getDb, hashPassword, initDatabase, getSuperAdminCount } from '@/lib/db';
import { jsonResponse } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    initDatabase();
    const { name, email, password, orgName } = await request.json();

    if (!name || !email || !password) {
      return Response.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (!orgName) {
      return Response.json({ error: 'Organization name is required' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      { id: number } | undefined;
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    const superAdminExists = getSuperAdminCount() > 0;

    let userRole: 'super_admin' | 'admin' = 'admin';
    let orgId: number | null = null;

    if (!superAdminExists) {
      userRole = 'super_admin';
    } else {
      userRole = 'admin';

      const insertOrg = db.prepare(
        'INSERT INTO organizations (name, plan_id, status, max_events, max_tickets) VALUES (?, 1, ?, 5, 500)'
      );
      const orgInfo = insertOrg.run(orgName, 'active');
      orgId = orgInfo.lastInsertRowid as number;

      db.prepare(
        'INSERT INTO subscriptions (org_id, plan_id, amount_cents, status, billing_cycle, starts_at) VALUES (?, 1, 0, ?, ?, ?)'
      ).run(orgId, 'active', 'monthly', new Date().toISOString());
    }

    const passwordHash = hashPassword(password);
    const info = db
      .prepare(
        'INSERT INTO users (org_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(orgId, name, email, passwordHash, userRole, 'active');

    return jsonResponse(
      {
        success: true,
        user: {
          id: info.lastInsertRowid,
          orgId,
          name,
          email,
          role: userRole,
        },
      },
      201
    );
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
