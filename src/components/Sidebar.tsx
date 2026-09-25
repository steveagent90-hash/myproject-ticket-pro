'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import {
  PenTool,
  QrCode,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Ticket,
  Settings,
  Users,
  CreditCard,
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userRole?: 'admin' | 'scanner';
}

const adminNavItems = [
  {
    id: 'nav-designer',
    label: 'Ticket Designer',
    icon: PenTool,
    href: '/ticket-designer',
    badge: null,
  },
  {
    id: 'nav-scanner',
    label: 'QR Scanner Portal',
    icon: QrCode,
    href: '/qr-code-verification-portal',
    badge: null,
  },
  {
    id: 'nav-settings',
    label: 'Settings',
    icon: Settings,
    href: '/admin-settings',
    badge: null,
  },
];

const scannerNavItems = [
  {
    id: 'nav-scanner-portal',
    label: 'QR Scanner Portal',
    icon: QrCode,
    href: '/qr-code-verification-portal',
    badge: null,
  },
];

export default function Sidebar({ collapsed, onToggle, userRole = 'admin' }: SidebarProps) {
  const pathname = usePathname();
  const navItems = userRole === 'admin' ? adminNavItems : scannerNavItems;

  return (
    <aside
      className="relative flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out flex-shrink-0"
      style={{ width: collapsed ? '64px' : '220px' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-border min-h-[64px]">
        <div className="flex-shrink-0">
          <AppLogo size={32} />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-foreground tracking-tight whitespace-nowrap overflow-hidden">
            TicketQR
          </span>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[72px] z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all duration-150"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
            {userRole === 'admin' ? 'Tools' : 'Scanner'}
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href === '/ticket-designer' && pathname === '/');
          return (
            <Link
              key={item.id}
              href={item.href === '/ticket-designer' ? '/' : item.href}
              className={`
                flex items-center gap-3 px-2 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group relative
                ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {item.label}
                </span>
              )}
              {item.badge && !collapsed && (
                <span className="ml-auto text-xs bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 font-semibold">
                  {item.badge}
                </span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user section */}
      <div className="border-t border-border px-2 py-3 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-foreground truncate">
                {userRole === 'admin' ? 'Alex Harmon' : 'Sam Torres'}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">{userRole}</p>
            </div>
          </div>
        )}
        <Link
          href="/sign-up-login-screen"
          className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:text-status-invalid hover:bg-status-invalid/10 transition-all duration-150 group relative"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
              Sign Out
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}
