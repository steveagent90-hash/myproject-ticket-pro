import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const plans = db
    .prepare(
      'SELECT id, name, description, price_cents, currency, billing_cycle, max_events, max_tickets, features, is_active, created_at FROM plans ORDER BY price_cents'
    )
    .all();

  return Response.json({ plans });
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
    const { name, description, price, currency, billingCycle, maxEvents, maxTickets, features } =
      body;

    if (!name || !price) {
      return Response.json({ error: 'Name and price are required' }, { status: 400 });
    }

    const info = db
      .prepare(
        'INSERT INTO plans (name, description, price_cents, currency, billing_cycle, max_events, max_tickets, features, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        name,
        description,
        price * 100,
        currency ?? 'USD',
        billingCycle ?? 'monthly',
        maxEvents ?? 10,
        maxTickets ?? 1000,
        features ? JSON.stringify(features) : '{}',
        1
      );

    return Response.json(
      {
        success: true,
        plan: { id: info.lastInsertRowid, name, price, currency: currency ?? 'USD' },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create plan error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
