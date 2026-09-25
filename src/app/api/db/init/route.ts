import { initDatabase, getDb } from '@/lib/db';

export async function GET() {
  try {
    initDatabase();
    const db = getDb();
    const stats = {
      organizations: db.prepare('SELECT COUNT(*) as c FROM organizations').get(),
      users: db.prepare('SELECT COUNT(*) as c FROM users').get(),
      events: db.prepare('SELECT COUNT(*) as c FROM events').get(),
      tickets: db.prepare('SELECT COUNT(*) as c FROM tickets').get(),
      plans: db.prepare('SELECT COUNT(*) as c FROM plans').get(),
      subscriptions: db.prepare('SELECT COUNT(*) as c FROM subscriptions').get(),
    };
    return Response.json({ success: true, message: 'Database initialized successfully', stats });
  } catch (error) {
    console.error('DB init error:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
