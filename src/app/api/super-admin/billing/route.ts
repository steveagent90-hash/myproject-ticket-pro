import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const billing = db
    .prepare(
      `
    SELECT b.id, b.invoice_number, b.amount_cents, b.currency, b.status, b.issue_date, b.due_date, b.paid_at,
           o.name as org_name, o.id as org_id,
           u.name as created_by_name
    FROM billing b
    JOIN organizations o ON b.org_id = o.id
    LEFT JOIN users u ON b.created_by = u.id
    ORDER BY b.created_at DESC
  `
    )
    .all();

  return Response.json({ billing });
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
    const { orgId, amount, currency, dueDate, description, subscriptionId } = body;

    if (!orgId || !amount || !currency) {
      return Response.json({ error: 'orgId, amount, and currency are required' }, { status: 400 });
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;

    const info = db
      .prepare(
        'INSERT INTO billing (org_id, subscription_id, invoice_number, amount_cents, currency, status, due_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        Number(orgId),
        subscriptionId ? Number(subscriptionId) : null,
        invoiceNumber,
        Number(amount) * 100,
        currency,
        'unpaid',
        dueDate || null,
        auth.user.id,
        new Date().toISOString()
      );

    const record = db
      .prepare('SELECT * FROM billing WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;

    return Response.json(
      {
        success: true,
        billing: record,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create billing error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
