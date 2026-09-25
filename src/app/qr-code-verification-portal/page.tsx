import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { initDatabase } from '@/lib/db';
import AppLayout from '@/components/AppLayout';
import QRVerificationScreen from './components/QRVerificationScreen';

export default async function QRVerificationPage() {
  initDatabase();
  const user = await getServerSession();

  if (!user) {
    redirect('/sign-up-login-screen');
  }

  return (
    <AppLayout userRole={user.role === 'scanner' ? 'scanner' : 'admin'}>
      <QRVerificationScreen
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
