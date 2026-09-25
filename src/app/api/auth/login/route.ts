import { getDb, verifyPassword, createSession, initDatabase } from '@/lib/db';
import { SESSION_COOKIE, jsonResponse } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    initDatabase();
    const { email, password, role } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare(
        'SELECT id, org_id as orgId, name, email, password_hash, role, status FROM users WHERE email = ?'
      )
      .get(email) as
      | {
          id: number;
          orgId: number | null;
          name: string;
          email: string;
          password_hash: string;
          role: string;
          status: string;
        }
      | undefined;

    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return Response.json({ error: 'Account is not active' }, { status: 403 });
    }

    if (role && user.role !== role) {
      return Response.json({ error: 'Access denied for this role' }, { status: 403 });
    }

    const token = createSession(user.id, user.orgId, user.role, user.name, user.email);

    return jsonResponse(
      {
        success: true,
        user: {
          id: user.id,
          orgId: user.orgId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      200,
      { name: SESSION_COOKIE, value: token, maxAge: 30 * 24 * 60 * 60, httpOnly: true }
    );
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
