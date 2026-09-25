import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  const totalOrgs = db.prepare('SELECT COUNT(*) as c FROM organizations').get() as { c: number };
  const activeOrgs = db
    .prepare("SELECT COUNT(*) as c FROM organizations WHERE status = 'active'")
    .get() as { c: number };
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  const totalTickets = db.prepare('SELECT COUNT(*) as c FROM tickets').get() as { c: number };
  const totalScans = db.prepare('SELECT COUNT(*) as c FROM scan_logs').get() as { c: number };

  const totalRevenue = db
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM billing WHERE status = 'paid'")
    .get() as { total: number };
  const pendingInvoices = db
    .prepare("SELECT COUNT(*) as c FROM billing WHERE status = 'unpaid'")
    .get() as { c: number };
  const activeSubs = db
    .prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'")
    .get() as { c: number };

  const recentOrgs = db
    .prepare(
      `
    SELECT id, name, status, plan_id, max_events, max_tickets, created_at
    FROM organizations ORDER BY created_at DESC LIMIT 5
  `
    )
    .all();

  const recentBilling = db
    .prepare(
      `
    SELECT b.id, b.invoice_number, b.amount_cents, b.currency, b.status, b.due_date, b.paid_at,
           o.name as org_name
    FROM billing b
    JOIN organizations o ON b.org_id = o.id
    ORDER BY b.created_at DESC LIMIT 5
  `
    )
    .all();

  const recentLogs = db
    .prepare(
      `
    SELECT result, COUNT(*) as cnt FROM scan_logs GROUP BY result ORDER BY cnt DESC
  `
    )
    .all();

  return Response.json({
    stats: {
      totalOrgs: totalOrgs.c,
      activeOrgs: activeOrgs.c,
      totalUsers: totalUsers.c,
      totalTickets: totalTickets.c,
      totalScans: totalScans.c,
      totalRevenue: Math.round(totalRevenue.total / 100),
      pendingInvoices: pendingInvoices.c,
      activeSubs: activeSubs.c,
    },
    recentOrgs,
    recentBilling,
    scanResults: recentLogs,
  });
}
