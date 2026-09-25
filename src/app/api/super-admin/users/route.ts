import { getDb, initDatabase, hashPassword } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const users = db
    .prepare(
      `
    SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.updated_at, o.name as org_name
    FROM users u
    LEFT JOIN organizations o ON u.org_id = o.id
    ORDER BY u.created_at DESC
  `
    )
    .all();

  const orgs = db.prepare('SELECT id, name FROM organizations').all();

  return Response.json({ users, orgs });
}

export async function POST(request: Request) {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { name, email, password, role, orgId, status } = body;

    if (!name || !email || !password || !role) {
      return Response.json(
        { error: 'Name, email, password, and role are required' },
        { status: 400 }
      );
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      { id: number } | undefined;
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const info = db
      .prepare(
        'INSERT INTO users (org_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(orgId ?? null, name, email, passwordHash, role, status ?? 'active');

    return Response.json(
      {
        success: true,
        user: {
          id: info.lastInsertRowid,
          name,
          email,
          role,
          orgId: orgId ?? null,
          status: status ?? 'active',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
