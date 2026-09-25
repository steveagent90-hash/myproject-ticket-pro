import { destroyServerSession } from '@/lib/auth';
import { SESSION_COOKIE, jsonResponse } from '@/lib/auth';
import { initDatabase } from '@/lib/db';

export async function POST() {
  try {
    initDatabase();
    destroyServerSession();
    return jsonResponse({ success: true, message: 'Logged out successfully' }, 200, {
      name: SESSION_COOKIE,
      value: '',
      maxAge: 0,
      httpOnly: true,
    });
  } catch (error) {
    console.error('Logout error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
