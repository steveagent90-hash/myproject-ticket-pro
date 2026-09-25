import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface OrgParams {
  id: string;
}

export async function GET(request: Request, { params }: { params: Promise<OrgParams> }) {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  initDatabase();
  const db = getDb();

  const org = db
    .prepare(
      `
    SELECT o.id, o.name, o.status, o.max_events, o.max_tickets, o.created_at, o.updated_at,
           p.name as plan_name, p.price_cents, p.currency, p.billing_cycle,
           p.features, p.max_events as plan_max_events, p.max_tickets as plan_max_tickets
    FROM organizations o
    LEFT JOIN plans p ON o.plan_id = p.id
    WHERE o.id = ?
  `
    )
    .get(Number(id)) as Record<string, unknown> | undefined;

  if (!org) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  const users = db
    .prepare(
      `
    SELECT id, name, email, role, status, created_at FROM users WHERE org_id = ?
  `
    )
    .all(Number(id));

  const subscriptions = db
    .prepare(
      `
    SELECT s.id, s.status, s.amount_cents, s.currency, s.billing_cycle, s.starts_at, s.ends_at,
           p.name as plan_name
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.org_id = ? ORDER BY s.created_at DESC
  `
    )
    .all(Number(id));

  const billing = db
    .prepare(
      `
    SELECT b.id, b.invoice_number, b.amount_cents, b.currency, b.status, b.issue_date, b.due_date, b.paid_at
    FROM billing b WHERE b.org_id = ? ORDER BY b.created_at DESC
  `
    )
    .all(Number(id));

  return Response.json({ org, users, subscriptions, billing });
}

export async function PUT(request: Request, { params }: { params: Promise<OrgParams> }) {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { name, planId, maxEvents, maxTickets, status } = body;

    db.prepare(
      "UPDATE organizations SET name = ?, plan_id = ?, max_events = ?, max_tickets = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(name, planId, maxEvents, maxTickets, status, Number(id));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update org error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
