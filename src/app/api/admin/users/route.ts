import { getDb, hashPassword, initDatabase } from '@/lib/db';
import { requireAuth, jsonResponse } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const orgId = auth.user.role === 'super_admin' ? null : auth.user.orgId;

  let query = `
    SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
           o.name as org_name
    FROM users u
    LEFT JOIN organizations o ON u.org_id = o.id
    WHERE u.role != 'super_admin'
  `;
  const params: (string | number)[] = [];

  if (orgId) {
    query += ' AND u.org_id = ?';
    params.push(orgId);
  }

  query += ' ORDER BY u.created_at DESC';

  const users = db.prepare(query).all(...params);

  return jsonResponse({ users });
}

export async function POST(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { name, email, password, role, orgId: requestedOrgId } = body;

    if (!name || !email || !password || !role) {
      return Response.json(
        { error: 'Name, email, password, and role are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const validRoles = ['scanner', 'admin'];
    if (!validRoles.includes(role)) {
      return Response.json(
        { error: 'Invalid role. Allowed roles: scanner, admin' },
        { status: 400 }
      );
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      { id: number } | undefined;
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    let orgId: number | null = null;

    if (auth.user.role === 'admin') {
      orgId = auth.user.orgId;
      if (!orgId) {
        return Response.json(
          { error: 'Admin user must belong to an organization' },
          { status: 400 }
        );
      }

      const orgCheck = db
        .prepare('SELECT id, status FROM organizations WHERE id = ?')
        .get(orgId) as { id: number; status: string } | undefined;
      if (!orgCheck || orgCheck.status !== 'active') {
        return Response.json({ error: 'Organization is not active' }, { status: 400 });
      }
    } else if (auth.user.role === 'super_admin') {
      orgId = requestedOrgId ? Number(requestedOrgId) : null;
    }

    const passwordHash = hashPassword(password);
    const info = db
      .prepare(
        'INSERT INTO users (org_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(orgId, name, email, passwordHash, role, 'active');

    return jsonResponse(
      {
        success: true,
        user: {
          id: info.lastInsertRowid,
          orgId,
          name,
          email,
          role,
        },
      },
      201
    );
  } catch (error) {
    console.error('Create user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
