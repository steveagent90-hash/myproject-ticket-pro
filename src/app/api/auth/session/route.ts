import { getServerSession } from '@/lib/auth';
import { initDatabase } from '@/lib/db';

export async function GET() {
  try {
    initDatabase();
    const user = getServerSession();
    if (!user) {
      return Response.json({ user: null }, { status: 401 });
    }
    return Response.json({ user });
  } catch (error) {
    console.error('Session error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
