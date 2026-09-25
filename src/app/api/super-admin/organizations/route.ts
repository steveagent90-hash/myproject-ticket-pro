import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const orgs = db
    .prepare(
      `
    SELECT o.id, o.name, o.status, o.max_events, o.max_tickets, o.created_at, o.updated_at,
           p.name as plan_name, p.price_cents, p.currency,
           (SELECT COUNT(*) FROM users WHERE org_id = o.id) as user_count
    FROM organizations o
    LEFT JOIN plans p ON o.plan_id = p.id
    ORDER BY o.created_at DESC
  `
    )
    .all();

  const plans = db
    .prepare(
      'SELECT id, name, price_cents, currency, billing_cycle FROM plans ORDER BY price_cents'
    )
    .all();

  return Response.json({ orgs, plans });
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
    const { name, planId, maxEvents, maxTickets, status } = body;

    if (!name) {
      return Response.json({ error: 'Organization name is required' }, { status: 400 });
    }

    const info = db
      .prepare(
        'INSERT INTO organizations (name, plan_id, status, max_events, max_tickets) VALUES (?, ?, ?, ?, ?)'
      )
      .run(name, planId ?? 1, status ?? 'active', maxEvents ?? 10, maxTickets ?? 1000);

    return Response.json(
      {
        success: true,
        id: info.lastInsertRowid,
        name,
        planId: planId ?? 1,
        status: status ?? 'active',
        maxEvents: maxEvents ?? 10,
        maxTickets: maxTickets ?? 1000,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create org error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
