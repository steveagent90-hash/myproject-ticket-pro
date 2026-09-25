'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CreditCard,
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  User,
  Mail,
  Shield,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  TrendingUp,
  Calendar,
  Building2,
  Lock,
  RefreshCw,
} from 'lucide-react';

type SettingsTab = 'subscription' | 'users' | 'billing';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface Plan {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  max_events: number;
  max_tickets: number;
  features: string;
}

interface Subscription {
  id: number;
  plan_id: number;
  plan_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  billing_cycle: string;
  starts_at: string;
  ends_at: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
}

interface OrgStats {
  totalEvents: number;
  totalTickets: number;
  totalScans: number;
}

interface Props {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    orgId?: number;
  };
}

function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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

export default function AdminSettingsScreen({ user }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('subscription');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<OrgStats>({ totalEvents: 0, totalTickets: 0, totalScans: 0 });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/subscription', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSubscription(data.subscription || null);
        setPlans(data.plans || []);
        setInvoices(data.invoices || []);
        setStats(data.stats || { totalEvents: 0, totalTickets: 0, totalScans: 0 });
      }
    } catch (error) {
      console.error('Fetch subscription error:', error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchData(), fetchUsers()]);
      setLoading(false);
    };
    load();
  }, [fetchData, fetchUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchUsers()]);
    setRefreshing(false);
  };

  const handleChangePlan = async (planId: number) => {
    if (!confirm('Are you sure you want to change your subscription plan?')) return;
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        alert('Subscription updated successfully!');
        fetchData();
      } else {
        alert(data.error || 'Failed to update subscription');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  const handleCreateUser = async (userData: {
    name: string;
    email: string;
    password: string;
    role: string;
  }) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setShowUserModal(false);
        fetchUsers();
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'users', label: 'Team Users', icon: Users },
    { id: 'billing', label: 'Billing History', icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex gap-1 mt-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'subscription' && (
          <SubscriptionTab
            subscription={subscription}
            plans={plans}
            stats={stats}
            onChangePlan={handleChangePlan}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onCreateUser={() => {
              setEditingUser(null);
              setShowUserModal(true);
            }}
            onDeleteUser={handleDeleteUser}
          />
        )}
        {activeTab === 'billing' && <BillingTab invoices={invoices} />}
      </div>

      {showUserModal && (
        <UserModal
          user={editingUser}
          onClose={() => setShowUserModal(false)}
          onSave={handleCreateUser}
        />
      )}
    </div>
  );
}

function SubscriptionTab({
  subscription,
  plans,
  stats,
  onChangePlan,
}: {
  subscription: Subscription | null;
  plans: Plan[];
  stats: OrgStats;
  onChangePlan: (planId: number) => void;
}) {
  const currentPlanId = subscription?.plan_id;
  const maxEvents = subscription
    ? (plans.find((p) => p.id === subscription?.plan_id)?.max_events ?? 0)
    : 0;
  const maxTickets = subscription
    ? (plans.find((p) => p.id === subscription?.plan_id)?.max_tickets ?? 0)
    : 0;

  return (
    <div className="space-y-6">
      {subscription && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{subscription.plan_name}</h3>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(subscription.amount_cents, subscription.currency)} /{' '}
                {subscription.billing_cycle}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                subscription.status === 'active'
                  ? 'bg-status-valid/10 text-status-valid'
                  : 'bg-status-pending/10 text-status-pending'
              }`}
            >
              {subscription.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.totalEvents}</p>
              <p className="text-xs text-muted-foreground">
                Events {maxEvents > 0 ? `/ ${maxEvents}` : ''}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.totalTickets}</p>
              <p className="text-xs text-muted-foreground">
                Tickets {maxTickets > 0 ? `/ ${maxTickets}` : ''}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.totalScans}</p>
              <p className="text-xs text-muted-foreground">Scans</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={14} />
            <span>
              Current period: {formatDate(subscription.starts_at)} —{' '}
              {formatDate(subscription.ends_at)}
            </span>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isCurrent
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-foreground">{plan.name}</h4>
                  {isCurrent && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                <p className="text-xl font-bold text-foreground mb-2">
                  {plan.price_cents > 0 ? formatCurrency(plan.price_cents, plan.currency) : 'Free'}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                  <li>• {plan.max_events > 0 ? plan.max_events : 'Unlimited'} events</li>
                  <li>
                    • {plan.max_tickets > 0 ? plan.max_tickets.toLocaleString() : 'Unlimited'}{' '}
                    tickets
                  </li>
                </ul>
                {!isCurrent && (
                  <button
                    onClick={() => onChangePlan(plan.id)}
                    className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    {plan.price_cents > (subscription?.amount_cents ?? 0) ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsersTab({
  users,
  searchQuery,
  setSearchQuery,
  onCreateUser,
  onDeleteUser,
}: {
  users: User[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onCreateUser: () => void;
  onDeleteUser: (id: number) => void;
}) {
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <button
          onClick={onCreateUser}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Add User
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-accent/10 text-accent'
                        }`}
                      >
                        {u.role === 'admin' ? 'Admin' : 'Scanner'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          u.status === 'active'
                            ? 'bg-status-valid/10 text-status-valid'
                            : 'bg-status-invalid/10 text-status-invalid'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDeleteUser(u.id)}
                        className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-status-invalid hover:bg-status-invalid/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
      </p>
    </div>
  );
}

function BillingTab({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-foreground">{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-mono text-foreground">
                      {formatCurrency(inv.amount_cents, inv.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          inv.status === 'paid'
                            ? 'bg-status-valid/10 text-status-valid'
                            : inv.status === 'unpaid'
                              ? 'bg-status-pending/10 text-status-pending'
                              : 'bg-status-invalid/10 text-status-invalid'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {inv.paid_at ? formatDate(inv.paid_at) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserModal({
  user,
  onClose,
  onSave,
}: {
  user: User | null;
  onClose: () => void;
  onSave: (data: { name: string; email: string; password: string; role: string }) => void;
}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'scanner');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || (!user && !password)) {
      alert('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    await onSave({ name, email, password, role });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {user ? 'Edit User' : 'Add New User'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Full Name</label>
            <div className="relative">
              <User
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                required
              />
            </div>
          </div>

          {!user && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                  minLength={8}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('scanner')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md border transition-colors ${
                  role === 'scanner'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <QrCode size={16} />
                <span className="text-sm font-medium">Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md border transition-colors ${
                  role === 'admin'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Shield size={16} />
                <span className="text-sm font-medium">Admin</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {role === 'scanner'
                ? 'QR Verification Portal access only'
                : 'Full access to ticket designer and scanner'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving...' : user ? 'Update' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
