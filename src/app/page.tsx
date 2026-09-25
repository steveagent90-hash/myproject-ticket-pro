import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { initDatabase } from '@/lib/db';
import AppLayout from '@/components/AppLayout';
import TicketDesignerScreen from './ticket-designer/components/TicketDesignerScreen';

export default async function HomePage() {
  initDatabase();
  const user = await getServerSession();

  if (!user) {
    redirect('/sign-up-login-screen');
  }

  if (user.role === 'super_admin') {
    redirect('/super-admin');
  }

  const userRole = user.role === 'scanner' ? 'scanner' : 'admin';

  return (
    <AppLayout userRole={userRole}>
      <TicketDesignerScreen
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          orgId: user.orgId ?? undefined,
        }}
      />
    </AppLayout>
  );
}
