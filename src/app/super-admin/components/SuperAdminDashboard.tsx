'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  CreditCard,
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Menu,
  LogOut,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { SessionUser } from '@/lib/auth';

type Tab = 'overview' | 'organizations' | 'users' | 'billing' | 'subscriptions' | 'plans';

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: string;
}

function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-status-valid/10 text-status-valid' },
    suspended: { label: 'Suspended', className: 'bg-status-invalid/10 text-status-invalid' },
    cancelled: { label: 'Cancelled', className: 'bg-status-invalid/10 text-status-invalid' },
    pending: { label: 'Pending', className: 'bg-status-pending/10 text-status-pending' },
    unpaid: { label: 'Unpaid', className: 'bg-status-invalid/10 text-status-invalid' },
    paid: { label: 'Paid', className: 'bg-status-valid/10 text-status-valid' },
    failed: { label: 'Failed', className: 'bg-status-invalid/10 text-status-invalid' },
    draft: { label: 'Draft', className: 'bg-status-pending/10 text-status-pending' },
    expired: { label: 'Expired', className: 'bg-status-pending/10 text-status-pending' },
    past_due: { label: 'Past Due', className: 'bg-status-invalid/10 text-status-invalid' },
  };
  const cfg = config[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: 'bg-primary/10 text-primary',
    admin: 'bg-accent/10 text-accent',
    scanner: 'bg-status-pending/10 text-status-pending',
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[role] || 'bg-muted text-muted-foreground'}`}
    >
      {role.replace('_', ' ')}
    </span>
  );
}

const TAB_CONFIG: {
  id: Tab;
  label: string;
  icon: React.ComponentType<any>;
  mobileLabel: string;
}[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, mobileLabel: 'Home' },
  { id: 'organizations', label: 'Organizations', icon: Building2, mobileLabel: 'Orgs' },
  { id: 'users', label: 'Users', icon: Users, mobileLabel: 'Users' },
  { id: 'billing', label: 'Billing', icon: FileText, mobileLabel: 'Billing' },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, mobileLabel: 'Subs' },
  { id: 'plans', label: 'Plans', icon: Package, mobileLabel: 'Plans' },
];

export default function SuperAdminDashboard({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<Record<Tab, any>>({
    overview: null,
    organizations: null,
    users: null,
    billing: null,
    subscriptions: null,
    plans: null,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'org' | 'user' | 'billing' | 'plan' | 'subscription'>(
    'org'
  );
  const [editRecord, setEditRecord] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchTab = useCallback(async (tab: Tab) => {
    const endpoints: Record<Tab, string> = {
      overview: '/api/super-admin/stats',
      organizations: '/api/super-admin/organizations',
      users: '/api/super-admin/users',
      billing: '/api/super-admin/billing',
      subscriptions: '/api/super-admin/subscriptions',
      plans: '/api/super-admin/plans',
    };

    try {
      const res = await fetch(endpoints[tab], { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setData((prev) => ({ ...prev, [tab]: json }));
    } catch (error) {
      console.error(`Fetch ${tab} error:`, error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all(Object.keys(TAB_CONFIG).map((_, i) => fetchTab(TAB_CONFIG[i].id)));
    setLoading(false);
  }, [fetchTab]);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setSearchQuery('');
  };

  const openModal = (type: 'org' | 'user' | 'billing' | 'plan' | 'subscription', record?: any) => {
    setModalType(type);
    setEditRecord(record || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('org');
    setEditRecord(null);
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchTab(activeTab);
    if (activeTab === 'overview') await fetchAll();
    setRefreshing(false);
  };

  const handleSaved = () => {
    closeModal();
    fetchTab(activeTab);
    if (activeTab === 'overview') fetchAll();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/sign-up-login-screen';
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:relative z-50 lg:z-auto transform transition-transform duration-300 ease-in-out bg-card border-r border-border flex flex-col h-screen w-64 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <AppLogo size={32} />
          <span className="font-bold text-lg text-foreground">Super Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-status-invalid hover:bg-status-invalid/10 rounded-md transition-all duration-150"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary transition-all"
              aria-label="Toggle menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-foreground">
              {TAB_CONFIG.find((t) => t.id === activeTab)?.label}
            </h1>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => openModal('billing')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={12} />
              New Invoice
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-foreground">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">{user.email}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-primary" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-4">
          {loading && activeTab !== 'overview' && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="animate-spin text-primary" />
            </div>
          )}
          {!loading && (
            <>
              {activeTab === 'overview' && <OverviewTab stats={data.overview} />}
              {activeTab === 'organizations' && (
                <DataTableTab
                  data={data.organizations?.orgs || []}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onAdd={() => openModal('org')}
                  onEdit={(rec) => openModal('org', rec)}
                  onDelete={async (rec) => {
                    if (confirm(`Delete organization "${rec.name}"?`)) {
                      const res = await fetch(`/api/super-admin/organizations/${rec.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setData((prev) => ({
                          ...prev,
                          organizations: {
                            ...prev.organizations,
                            orgs: prev.organizations.orgs.filter((o: any) => o.id !== rec.id),
                          },
                        }));
                      }
                    }
                  }}
                  searchPlaceholder="Search organizations..."
                  emptyMessage="No organizations found."
                  columns={[
                    {
                      header: 'Name',
                      render: (r: any) => (
                        <span className="font-medium text-foreground">{r.name}</span>
                      ),
                    },
                    { header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                    {
                      header: 'Plan',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">{r.plan_name || '—'}</span>
                      ),
                    },
                    {
                      header: 'Users',
                      render: (r: any) => (
                        <span className="font-mono text-sm text-foreground">{r.user_count}</span>
                      ),
                    },
                    {
                      header: 'Created',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(r.created_at)}
                        </span>
                      ),
                    },
                  ]}
                  actions={(rec: any) => (
                    <>
                      <button
                        onClick={() => openModal('org', rec)}
                        className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                        title="Edit"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete "${rec.name}"? This cannot be undone.`)) {
                            const res = await fetch(`/api/super-admin/organizations/${rec.id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });
                            if (res.ok) {
                              setData((prev) => ({
                                ...prev,
                                organizations: {
                                  ...prev.organizations,
                                  orgs: prev.organizations.orgs.filter((o: any) => o.id !== rec.id),
                                },
                              }));
                            }
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-status-invalid hover:bg-status-invalid/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                />
              )}
              {activeTab === 'users' && (
                <DataTableTab
                  data={data.users?.users || []}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onAdd={() => openModal('user')}
                  onEdit={(rec) => openModal('user', rec)}
                  onDelete={async (rec) => {
                    if (confirm(`Delete user "${rec.name}"?`)) {
                      const res = await fetch(`/api/super-admin/users/${rec.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setData((prev) => ({
                          ...prev,
                          users: {
                            ...prev.users,
                            users: prev.users.users.filter((u: any) => u.id !== rec.id),
                          },
                        }));
                      }
                    }
                  }}
                  searchPlaceholder="Search users..."
                  emptyMessage="No users found."
                  columns={[
                    {
                      header: 'User',
                      render: (r: any) => (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                            <User size={13} className="text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{r.name}</span>
                        </div>
                      ),
                    },
                    {
                      header: 'Email',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">{r.email}</span>
                      ),
                    },
                    { header: 'Role', render: (r: any) => <RoleBadge role={r.role} /> },
                    {
                      header: 'Org',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">{r.org_name || '—'}</span>
                      ),
                    },
                    {
                      header: 'Created',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(r.created_at)}
                        </span>
                      ),
                    },
                  ]}
                  actions={(rec: any) => (
                    <button
                      onClick={() => openModal('user', rec)}
                      className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                      title="Edit"
                    >
                      <Edit size={13} />
                    </button>
                  )}
                />
              )}
              {activeTab === 'billing' && (
                <DataTableTab
                  data={data.billing?.billing || []}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onAdd={() => openModal('billing')}
                  onEdit={(rec) => openModal('billing', rec)}
                  onDelete={async (rec) => {
                    if (confirm(`Delete invoice ${rec.invoice_number}?`)) {
                      const res = await fetch(`/api/super-admin/billing/${rec.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setData((prev) => ({
                          ...prev,
                          billing: {
                            ...prev.billing,
                            billing: prev.billing.billing.filter((b: any) => b.id !== rec.id),
                          },
                        }));
                      }
                    }
                  }}
                  searchPlaceholder="Search invoices..."
                  emptyMessage="No invoices found."
                  columns={[
                    {
                      header: 'Invoice #',
                      render: (r: any) => (
                        <span className="font-mono text-sm text-foreground">
                          {r.invoice_number}
                        </span>
                      ),
                    },
                    {
                      header: 'Organization',
                      render: (r: any) => (
                        <span className="text-sm text-foreground">{r.org_name}</span>
                      ),
                    },
                    {
                      header: 'Amount',
                      render: (r: any) => (
                        <span className="font-mono text-sm text-foreground">
                          {formatCurrency(r.amount_cents, r.currency)}
                        </span>
                      ),
                    },
                    { header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                    {
                      header: 'Due Date',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(r.due_date)}
                        </span>
                      ),
                    },
                    {
                      header: 'Paid',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {r.paid_at ? formatDate(r.paid_at) : '—'}
                        </span>
                      ),
                    },
                  ]}
                  actions={(rec: any) => (
                    <>
                      {rec.status === 'unpaid' && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/super-admin/billing/${rec.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                status: 'paid',
                                paidAt: new Date().toISOString(),
                              }),
                              credentials: 'include',
                            });
                            if (res.ok) {
                              setData((prev) => ({
                                ...prev,
                                billing: {
                                  ...prev.billing,
                                  billing: prev.billing.billing.map((b: any) =>
                                    b.id === rec.id
                                      ? { ...b, status: 'paid', paid_at: new Date().toISOString() }
                                      : b
                                  ),
                                },
                              }));
                            }
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded text-status-valid hover:bg-status-valid/10 transition-colors"
                          title="Mark as Paid"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => openModal('billing', rec)}
                        className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                        title="Edit"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete invoice ${rec.invoice_number}?`)) {
                            const res = await fetch(`/api/super-admin/billing/${rec.id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });
                            if (res.ok) {
                              setData((prev) => ({
                                ...prev,
                                billing: {
                                  ...prev.billing,
                                  billing: prev.billing.billing.filter((b: any) => b.id !== rec.id),
                                },
                              }));
                            }
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-status-invalid hover:bg-status-invalid/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                />
              )}
              {activeTab === 'subscriptions' && (
                <DataTableTab
                  data={data.subscriptions?.subscriptions || []}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onAdd={() => openModal('subscription')}
                  onEdit={(rec) => openModal('subscription', rec)}
                  onDelete={async (rec) => {
                    if (confirm(`Delete subscription for ${rec.org_name}?`)) {
                      const res = await fetch(`/api/super-admin/subscriptions/${rec.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setData((prev) => ({
                          ...prev,
                          subscriptions: {
                            ...prev.subscriptions,
                            subscriptions: prev.subscriptions.subscriptions.filter(
                              (s: any) => s.id !== rec.id
                            ),
                          },
                        }));
                      }
                    }
                  }}
                  searchPlaceholder="Search subscriptions..."
                  emptyMessage="No subscriptions found."
                  columns={[
                    {
                      header: 'Organization',
                      render: (r: any) => (
                        <span className="text-sm text-foreground">{r.org_name}</span>
                      ),
                    },
                    {
                      header: 'Plan',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">{r.plan_name}</span>
                      ),
                    },
                    {
                      header: 'Amount',
                      render: (r: any) => (
                        <span className="font-mono text-sm text-foreground">
                          {formatCurrency(r.amount_cents, r.currency)}
                        </span>
                      ),
                    },
                    { header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                    {
                      header: 'Start',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(r.starts_at)}
                        </span>
                      ),
                    },
                    {
                      header: 'End',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {r.ends_at ? formatDate(r.ends_at) : '—'}
                        </span>
                      ),
                    },
                  ]}
                  actions={(rec: any) => (
                    <button
                      onClick={() => openModal('subscription', rec)}
                      className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                      title="Edit"
                    >
                      <Edit size={13} />
                    </button>
                  )}
                />
              )}
              {activeTab === 'plans' && (
                <DataTableTab
                  data={data.plans?.plans || []}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onAdd={() => openModal('plan')}
                  onEdit={(rec) => openModal('plan', rec)}
                  onDelete={async (rec) => {
                    if (confirm(`Deactivate plan "${rec.name}"?`)) {
                      const res = await fetch(`/api/super-admin/plans/${rec.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setData((prev) => ({
                          ...prev,
                          plans: {
                            ...prev.plans,
                            plans: prev.plans.plans.filter((p: any) => p.id !== rec.id),
                          },
                        }));
                      }
                    }
                  }}
                  searchPlaceholder="Search plans..."
                  emptyMessage="No plans found."
                  columns={[
                    {
                      header: 'Plan',
                      render: (r: any) => (
                        <span className="font-medium text-foreground">{r.name}</span>
                      ),
                    },
                    {
                      header: 'Price',
                      render: (r: any) => (
                        <span className="font-mono text-sm text-foreground">
                          {r.price_cents > 0 ? formatCurrency(r.price_cents, r.currency) : 'Free'}
                        </span>
                      ),
                    },
                    {
                      header: 'Cycle',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground capitalize">
                          {r.billing_cycle}
                        </span>
                      ),
                    },
                    {
                      header: 'Limits',
                      render: (r: any) => (
                        <span className="text-sm text-muted-foreground">
                          {r.max_events} events / {r.max_tickets} tickets
                        </span>
                      ),
                    },
                    {
                      header: 'Status',
                      render: (r: any) => (
                        <StatusBadge status={r.is_active ? 'active' : 'cancelled'} />
                      ),
                    },
                  ]}
                  actions={(rec: any) => (
                    <button
                      onClick={() => openModal('plan', rec)}
                      className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                      title="Edit"
                    >
                      <Edit size={13} />
                    </button>
                  )}
                />
              )}
            </>
          )}
        </main>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border safe-area-bottom z-40">
        <div className="flex items-center justify-around px-1 py-2 overflow-x-auto scrollbar-hide">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-1 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showModal && (
        <Modal
          type={modalType}
          record={editRecord}
          orgs={data.organizations?.orgs || []}
          plans={data.plans?.plans || []}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function DataTableTab({
  data,
  searchQuery,
  setSearchQuery,
  onAdd,
  onEdit,
  onDelete,
  columns,
  actions,
  searchPlaceholder,
  emptyMessage,
}: {
  data: any[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onAdd: () => void;
  onEdit: (rec: any) => void;
  onDelete: (rec: any) => void;
  columns: { header: string; render: (r: any) => React.ReactNode }[];
  actions: (rec: any) => React.ReactNode;
  searchPlaceholder: string;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Add New
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {col.header}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((rec, i) => (
                  <tr
                    key={rec.id || i}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.header} className="px-3 py-2.5 align-top">
                        {col.render(rec)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">{actions(rec)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {data.length} {data.length === 1 ? 'item' : 'items'}
        </p>
      )}
    </div>
  );
}

function OverviewTab({ stats }: { stats: any }) {
  const s = stats?.stats || {};
  const statCards: StatCard[] = [
    { label: 'Organizations', value: s.totalOrgs ?? 0, icon: Building2, color: 'text-primary' },
    {
      label: 'Active Orgs',
      value: s.activeOrgs ?? 0,
      icon: CheckCircle2,
      color: 'text-status-valid',
    },
    { label: 'Users', value: s.totalUsers ?? 0, icon: Users, color: 'text-accent' },
    {
      label: 'Total Tickets',
      value: s.totalTickets ?? 0,
      icon: FileText,
      color: 'text-foreground',
    },
    { label: 'Total Scans', value: s.totalScans ?? 0, icon: TrendingUp, color: 'text-primary' },
    { label: 'Active Subs', value: s.activeSubs ?? 0, icon: CreditCard, color: 'text-accent' },
    {
      label: 'Pending Invoices',
      value: s.pendingInvoices ?? 0,
      icon: AlertTriangle,
      color: 'text-status-invalid',
    },
    {
      label: 'Revenue',
      value: `$${s.totalRevenue ?? 0}`,
      icon: DollarSign,
      color: 'text-status-valid',
    },
  ];

  const recentOrgs = stats?.recentOrgs || [];
  const recentBilling = stats?.recentBilling || [];
  const scanResults: { result: string; cnt: number }[] = stats?.scanResults || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Dashboard Stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-card border border-border rounded-lg p-4 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className={card.color} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Organizations
          </h3>
          <div className="space-y-2">
            {recentOrgs.map((org: any) => (
              <div
                key={org.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Plan ID {org.plan_id} · {org.max_tickets} ticket limit
                  </p>
                </div>
                <StatusBadge status={org.status} />
              </div>
            ))}
            {recentOrgs.length === 0 && (
              <p className="text-xs text-muted-foreground">No recent organizations.</p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Billing
          </h3>
          <div className="space-y-2">
            {recentBilling.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.org_name} · Due {formatDate(inv.due_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-foreground">
                    {formatCurrency(inv.amount_cents, inv.currency)}
                  </p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
            {recentBilling.length === 0 && (
              <p className="text-xs text-muted-foreground">No recent billing records.</p>
            )}
          </div>
        </div>
      </div>

      {scanResults.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Scan Results Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {scanResults.map((r) => {
              const icon =
                r.result === 'valid' ? CheckCircle2 : r.result === 'used' ? AlertTriangle : XCircle;
              const color =
                r.result === 'valid'
                  ? 'text-status-valid'
                  : r.result === 'used'
                    ? 'text-status-used'
                    : 'text-status-invalid';
              const Icon = icon;
              return (
                <div key={r.result} className="flex items-center gap-3 bg-muted/20 rounded-md p-3">
                  <Icon size={16} className={color} />
                  <div>
                    <p className={`text-lg font-bold ${color}`}>{r.cnt}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.result}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({
  type,
  record,
  orgs,
  plans,
  onClose,
  onSaved,
}: {
  type: 'org' | 'user' | 'billing' | 'plan' | 'subscription';
  record: any;
  orgs: any[];
  plans: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!record;
  const endpoint = `/api/super-admin/${type === 'org' ? 'organizations' : type === 'user' ? 'users' : type === 'billing' ? 'billing' : type === 'subscription' ? 'subscriptions' : 'plans'}${record ? `/${record.id}` : ''}`;
  const method = isEdit ? 'PUT' : 'POST';
  const [form, setForm] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      const isPlan = type === 'plan';
      const base = {
        name: record.name || '',
        description: record.description || '',
        email: record.email || '',
        password: '',
        role: record.role || 'admin',
        orgId: record.org_id || record.orgId || '',
        status: isPlan
          ? record.is_active === 1 || record.is_active === true
            ? 'active'
            : 'cancelled'
          : record.status || 'active',
        amount: record.amount_cents ? record.amount_cents / 100 : '',
        currency: record.currency || 'USD',
        dueDate: record.due_date ? record.due_date.split('T')[0] : '',
        price: record.price_cents ? record.price_cents / 100 : '',
        billingCycle: record.billing_cycle || 'monthly',
        planId: record.plan_id || record.plan_id || '',
        startsAt: record.starts_at ? record.starts_at.split('T')[0] : '',
        endsAt: record.ends_at ? record.ends_at.split('T')[0] : '',
        features: record.features || '',
        maxEvents: record.max_events || '',
        maxTickets: record.max_tickets || '',
      };
      setForm(base);
    } else {
      setForm({
        name: '',
        description: '',
        email: '',
        password: '',
        role: 'admin',
        orgId: '',
        status: 'active',
        amount: '',
        currency: 'USD',
        dueDate: '',
        price: '',
        billingCycle: 'monthly',
        planId: '',
        startsAt: '',
        endsAt: '',
        features: '',
        maxEvents: '',
        maxTickets: '',
      });
    }
  }, [record, type]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = (): Record<string, any> => {
    if (type === 'plan') {
      return {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        currency: form.currency,
        billingCycle: form.billingCycle,
        maxEvents: Number(form.maxEvents) || 10,
        maxTickets: Number(form.maxTickets) || 1000,
        isActive: form.status === 'active' ? 1 : 0,
        features: form.features,
      };
    }
    if (type === 'billing') {
      return {
        orgId: Number(form.orgId),
        amount: Number(form.amount),
        currency: form.currency,
        dueDate: form.dueDate,
        description: form.description,
        status: form.status,
      };
    }
    if (type === 'subscription') {
      return {
        orgId: Number(form.orgId),
        planId: Number(form.planId),
        status: form.status,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      };
    }
    if (type === 'org') {
      return {
        name: form.name,
        planId: Number(form.planId),
        maxEvents: Number(form.maxEvents) || 10,
        maxTickets: Number(form.maxTickets) || 1000,
        status: form.status,
      };
    }
    if (type === 'user') {
      return {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        orgId: form.orgId ? Number(form.orgId) : null,
        status: form.status,
      };
    }
    return {};
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const titles: Record<string, string> = {
    org: isEdit ? 'Edit Organization' : 'New Organization',
    user: isEdit ? 'Edit User' : 'New User',
    billing: isEdit ? 'Edit Invoice' : 'New Invoice',
    subscription: isEdit ? 'Edit Subscription' : 'New Subscription',
    plan: isEdit ? 'Edit Plan' : 'New Plan',
  };

  const renderInput = (label: string, field: string, type: string = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={form[field] ?? ''}
        onChange={(e) =>
          handleChange(field, type === 'number' ? Number(e.target.value) : e.target.value)
        }
        className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
      />
    </div>
  );

  const renderSelect = (
    label: string,
    field: string,
    options: { value: string; label: string }[]
  ) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <select
        value={form[field] ?? ''}
        onChange={(e) => handleChange(field, e.target.value)}
        className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  const renderOrgFields = () => (
    <>
      {renderInput('Organization Name', 'name')}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Plan</label>
        <select
          value={form.planId ?? ''}
          onChange={(e) => handleChange('planId', Number(e.target.value))}
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">Select a plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.price_cents > 0 ? formatCurrency(p.price_cents, p.currency) : 'Free'} /
              {p.billing_cycle}
            </option>
          ))}
        </select>
      </div>
      {renderInput('Max Events', 'maxEvents', 'number')}
      {renderInput('Max Tickets', 'maxTickets', 'number')}
      {renderSelect('Status', 'status', [
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'cancelled', label: 'Cancelled' },
      ])}
    </>
  );

  const renderUserFields = () => (
    <>
      {renderInput('Full Name', 'name')}
      {renderInput('Email', 'email', 'email')}
      {!isEdit && renderInput('Password', 'password', 'password')}
      {renderSelect('Role', 'role', [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'admin', label: 'Admin' },
        { value: 'scanner', label: 'Scanner' },
      ])}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
          Organization
        </label>
        <select
          value={form.orgId ?? ''}
          onChange={(e) => handleChange('orgId', e.target.value ? Number(e.target.value) : null)}
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">No organization (Super Admin only)</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      {renderSelect('Status', 'status', [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'suspended', label: 'Suspended' },
      ])}
    </>
  );

  const renderBillingFields = () => (
    <>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
          Organization
        </label>
        <select
          value={form.orgId ?? ''}
          onChange={(e) => handleChange('orgId', Number(e.target.value))}
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">Select organization</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      {renderInput('Amount ($)', 'amount', 'number')}
      {renderSelect('Currency', 'currency', [
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'GBP', label: 'GBP' },
      ])}
      {renderInput('Due Date', 'dueDate', 'date')}
      {renderSelect('Status', 'status', [
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'paid', label: 'Paid' },
        { value: 'failed', label: 'Failed' },
        { value: 'cancelled', label: 'Cancelled' },
      ])}
    </>
  );

  const renderSubscriptionFields = () => (
    <>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
          Organization
        </label>
        <select
          value={form.orgId ?? ''}
          onChange={(e) => handleChange('orgId', Number(e.target.value))}
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">Select organization</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Plan</label>
        <select
          value={form.planId ?? ''}
          onChange={(e) => handleChange('planId', Number(e.target.value))}
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">Select plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {renderSelect('Status', 'status', [
        { value: 'active', label: 'Active' },
        { value: 'pending', label: 'Pending' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'expired', label: 'Expired' },
      ])}
      {renderInput('Starts At', 'startsAt', 'date')}
      {renderInput('Ends At', 'endsAt', 'date')}
    </>
  );

  const renderPlanFields = () => (
    <>
      {renderInput('Plan Name', 'name')}
      {renderInput('Description', 'description')}
      {renderInput('Price ($)', 'price', 'number')}
      {renderSelect('Currency', 'currency', [
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'GBP', label: 'GBP' },
      ])}
      {renderSelect('Billing Cycle', 'billingCycle', [
        { value: 'monthly', label: 'Monthly' },
        { value: 'yearly', label: 'Yearly' },
      ])}
      {renderInput('Max Events', 'maxEvents', 'number')}
      {renderInput('Max Tickets', 'maxTickets', 'number')}
      {renderSelect('Status', 'status', [
        { value: 'active', label: 'Active' },
        { value: 'cancelled', label: 'Inactive' },
      ])}
    </>
  );

  const renderFields = () => {
    switch (type) {
      case 'org':
        return renderOrgFields();
      case 'user':
        return renderUserFields();
      case 'billing':
        return renderBillingFields();
      case 'subscription':
        return renderSubscriptionFields();
      case 'plan':
        return renderPlanFields();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{titles[type]}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">{renderFields()}</div>

        <div className="flex gap-2 p-4 border-t border-border bg-muted/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
