import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const subscriptions = db
    .prepare(
      `
    SELECT s.id, s.org_id, s.plan_id, s.amount_cents, s.currency, s.status, s.billing_cycle,
           s.starts_at, s.ends_at, s.cancelled_at, s.created_at, s.updated_at,
           o.name as org_name, p.name as plan_name
    FROM subscriptions s
    JOIN organizations o ON s.org_id = o.id
    JOIN plans p ON s.plan_id = p.id
    ORDER BY s.created_at DESC
  `
    )
    .all();

  return Response.json({ subscriptions });
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
    const { orgId, planId, status, billingCycle, startsAt, endsAt, amountCents, currency } = body;

    if (!orgId || !planId) {
      return Response.json({ error: 'orgId and planId are required' }, { status: 400 });
    }

    const plan = db
      .prepare('SELECT price_cents, currency, billing_cycle FROM plans WHERE id = ?')
      .get(Number(planId)) as
      { price_cents: number; currency: string; billing_cycle: string } | undefined;
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 });
    }

    const info = db
      .prepare(
        'INSERT INTO subscriptions (org_id, plan_id, amount_cents, currency, status, billing_cycle, starts_at, ends_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        Number(orgId),
        Number(planId),
        amountCents ?? plan.price_cents,
        currency ?? plan.currency,
        status ?? 'active',
        billingCycle ?? plan.billing_cycle,
        startsAt ?? new Date().toISOString(),
        endsAt ?? null,
        auth.user.id,
        new Date().toISOString()
      );

    db.prepare('UPDATE organizations SET plan_id = ? WHERE id = ?').run(planId, orgId);

    return Response.json(
      {
        success: true,
        subscription: { id: info.lastInsertRowid },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create subscription error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
