import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { initDatabase } from '@/lib/db';
import SuperAdminDashboard from './components/SuperAdminDashboard';

export const metadata = {
  title: 'Super Admin Dashboard — TicketQR',
  description: 'Manage organizations, billing, users, and plans for your SaaS ticketing platform.',
};

export default async function SuperAdminPage() {
  initDatabase();
  const user = await getServerSession();

  if (!user) {
    redirect('/sign-up-login-screen');
  }

  if (user.role !== 'super_admin') {
    redirect('/');
  }

  return (
    <SuperAdminDashboard
      user={{ id: user.id, orgId: user.orgId, role: user.role, name: user.name, email: user.email }}
    />
  );
}
