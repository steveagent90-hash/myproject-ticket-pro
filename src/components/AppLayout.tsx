'use client';
import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: 'admin' | 'scanner';
}

export default function AppLayout({ children, userRole = 'admin' }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          userRole={userRole}
        />
      </div>
      <main
        className="flex-1 overflow-auto transition-all duration-300 ease-in-out"
        style={{ marginLeft: 0 }}
      >
        {children}
      </main>
    </div>
  );
}
