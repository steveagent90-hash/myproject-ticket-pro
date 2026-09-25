import { getDb, initDatabase } from '@/lib/db';
import { requireAuth, jsonResponse } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const orgId = auth.user.orgId;
  if (!orgId) {
    return Response.json(
      { error: 'No organization associated with this account' },
      { status: 400 }
    );
  }

  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as
    | {
        id: number;
        name: string;
        plan_id: number;
        status: string;
        max_events: number;
        max_tickets: number;
        created_at: string;
      }
    | undefined;

  if (!org) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  const subscription = db
    .prepare(
      `SELECT s.*, p.name as plan_name, p.description as plan_description, p.price_cents, p.billing_cycle,
              p.max_events as plan_max_events, p.max_tickets as plan_max_tickets, p.features
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.org_id = ?
       ORDER BY s.created_at DESC
       LIMIT 1`
    )
    .get(orgId) as
    | {
        id: number;
        org_id: number;
        plan_id: number;
        amount_cents: number;
        currency: string;
        status: string;
        billing_cycle: string;
        starts_at: string;
        ends_at: string;
        plan_name: string;
        plan_description: string;
        price_cents: number;
        features: string;
      }
    | undefined;

  const plans = db
    .prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY price_cents ASC')
    .all() as Array<{
    id: number;
    name: string;
    description: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
    max_events: number;
    max_tickets: number;
    features: string;
  }>;

  const invoices = db
    .prepare(`SELECT * FROM billing WHERE org_id = ? ORDER BY created_at DESC LIMIT 10`)
    .all(orgId);

  const stats = {
    totalEvents: (
      db.prepare('SELECT COUNT(*) as cnt FROM events WHERE org_id = ?').get(orgId) as {
        cnt: number;
      }
    ).cnt,
    totalTickets: (
      db
        .prepare(
          'SELECT COUNT(*) as cnt FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.org_id = ?'
        )
        .get(orgId) as { cnt: number }
    ).cnt,
    totalScans: (
      db
        .prepare(
          'SELECT COUNT(*) as cnt FROM scan_logs s JOIN events e ON s.event_id = e.id WHERE e.org_id = ?'
        )
        .get(orgId) as { cnt: number }
    ).cnt,
  };

  return jsonResponse({
    organization: org,
    subscription,
    plans,
    invoices,
    stats,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAuth(['admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const orgId = auth.user.orgId;
  if (!orgId) {
    return Response.json(
      { error: 'No organization associated with this account' },
      { status: 400 }
    );
  }

  try {
    const { planId } = await request.json();

    if (!planId) {
      return Response.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId) as
      | {
          id: number;
          name: string;
          price_cents: number;
          billing_cycle: string;
          max_events: number;
          max_tickets: number;
        }
      | undefined;

    if (!plan) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    db.prepare(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = ? WHERE org_id = ? AND status = 'active'`
    ).run(now.toISOString(), orgId);

    db.prepare(
      `INSERT INTO subscriptions (org_id, plan_id, amount_cents, currency, status, billing_cycle, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orgId,
      plan.id,
      plan.price_cents,
      'USD',
      'active',
      plan.billing_cycle,
      now.toISOString(),
      endsAt.toISOString(),
      auth.user.id
    );

    db.prepare(
      'UPDATE organizations SET plan_id = ?, max_events = ?, max_tickets = ?, updated_at = ? WHERE id = ?'
    ).run(plan.id, plan.max_events, plan.max_tickets, now.toISOString(), orgId);

    return jsonResponse({
      success: true,
      message: 'Subscription updated successfully',
      plan: {
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents,
        billing_cycle: plan.billing_cycle,
      },
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
