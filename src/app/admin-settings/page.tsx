import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { initDatabase } from '@/lib/db';
import AppLayout from '@/components/AppLayout';
import AdminSettingsScreen from './components/AdminSettingsScreen';

export default async function AdminSettingsPage() {
  initDatabase();
  const user = await getServerSession();

  if (!user) {
    redirect('/sign-up-login-screen');
  }

  if (user.role === 'super_admin') {
    redirect('/super-admin');
  }

  if (user.role === 'scanner') {
    redirect('/qr-code-verification-portal');
  }

  return (
    <AppLayout userRole="admin">
      <AdminSettingsScreen
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
