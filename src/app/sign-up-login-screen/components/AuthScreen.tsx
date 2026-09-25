'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Eye,
  EyeOff,
  QrCode,
  PenTool,
  ArrowRight,
  Copy,
  Check,
  Shield,
  Zap,
  User,
  Mail,
  Lock,
  ChevronRight,
  CreditCard,
  Building2,
  Ticket,
  CheckCircle2,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

type AuthMode = 'login' | 'signup';

interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  orgName: string;
  terms: boolean;
}

const DEMO_CREDENTIALS = [
  {
    id: 'cred-admin',
    role: 'admin',
    roleLabel: 'Admin (Main User)',
    email: 'admin@ticketqr.io',
    password: 'Admin@2026',
    description: 'Full access: Design tickets, scan QR, manage team',
  },
  {
    id: 'cred-super',
    role: 'super_admin',
    roleLabel: 'Super Admin',
    email: 'superadmin@ticketqr.io',
    password: 'Admin@2026',
    description: 'Platform management & billing',
  },
];

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  const loginForm = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', remember: false },
  });

  const signupForm = useForm<SignupFormData>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      orgName: '',
      terms: false,
    },
  });

  const handleCopy = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const autofillCredentials = (cred: (typeof DEMO_CREDENTIALS)[0]) => {
    loginForm.setValue('email', cred.email);
    loginForm.setValue('password', cred.password);
  };

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
        credentials: 'include',
      });

      const result = await res.json();
      if (!res.ok) {
        loginForm.setError('email', { message: result.error || 'Invalid credentials' });
        setIsLoading(false);
        return;
      }

      setAuthSuccess(true);
      setIsLoading(false);
      const role = result.user.role;
      const destination =
        role === 'super_admin'
          ? '/super-admin'
          : role === 'admin'
            ? '/'
            : '/qr-code-verification-portal';
      setTimeout(() => {
        window.location.href = destination;
      }, 800);
    } catch (error) {
      loginForm.setError('email', { message: 'Network error — try again' });
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    if (data.password !== data.confirmPassword) {
      signupForm.setError('confirmPassword', { message: 'Passwords do not match' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: 'admin',
          orgName: data.orgName,
        }),
        credentials: 'include',
      });

      const result = await res.json();
      if (!res.ok) {
        signupForm.setError('email', { message: result.error || 'Failed to create account' });
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setMode('login');
      loginForm.setValue('email', data.email);
      loginForm.setValue('password', data.password);
    } catch (error) {
      signupForm.setError('email', { message: 'Network error — try again' });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-shrink-0 flex-col justify-between bg-gradient-to-br from-card via-card to-muted border-r border-border p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -left-16 w-72 h-72 rounded-full opacity-[0.03] bg-primary blur-3xl" />
          <div className="absolute bottom-32 -right-20 w-96 h-96 rounded-full opacity-[0.04] bg-accent blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full opacity-[0.02] bg-primary blur-2xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <AppLogo size={40} />
            <div>
              <span className="text-xl font-bold text-foreground tracking-tight">TicketQR</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Event Ticketing Platform
              </p>
            </div>
          </div>

          {/* Hero copy */}
          <div className="space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              Design tickets.
              <br />
              <span className="text-primary">Validate instantly.</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              Complete event ticketing solution — design beautiful tickets, generate unique QR
              codes, and validate entries in real-time at the gate.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              { icon: PenTool, text: 'Professional ticket designer with drag-and-drop' },
              { icon: QrCode, text: 'Auto-generated unique QR codes per ticket' },
              { icon: Zap, text: 'Real-time QR validation at event entry' },
              { icon: Shield, text: 'Team management — add scanners from your dashboard' },
              { icon: CreditCard, text: 'Flexible plans from free to enterprise' },
            ].map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{feat.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-6 pt-8 border-t border-border">
          {[
            { value: '2,400+', label: 'Events Powered' },
            { value: '1.2M', label: 'Tickets Generated' },
            { value: '99.97%', label: 'Scan Accuracy' },
          ].map((stat, i) => (
            <div key={i}>
              <p className="text-xl font-bold text-foreground font-mono">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Auth Panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto scrollbar-thin">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <AppLogo size={32} />
            <div>
              <span className="font-bold text-foreground">TicketQR</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Event Ticketing Platform
              </p>
            </div>
          </div>

          {/* Auth mode tabs */}
          <div className="flex bg-muted rounded-xl p-1.5 mb-8">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Success state */}
          {authSuccess && (
            <div className="flex items-center gap-3 px-4 py-3 bg-status-valid/10 border border-status-valid/30 rounded-xl mb-6 fade-in">
              <CheckCircle2 size={18} className="text-status-valid flex-shrink-0" />
              <p className="text-sm text-status-valid font-medium">
                Signed in successfully. Redirecting...
              </p>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5 fade-in">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className={`w-full pl-10 pr-4 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      loginForm.formState.errors.email ? 'border-status-invalid' : 'border-border'
                    }`}
                    {...loginForm.register('email', {
                      required: 'Email is required',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                    })}
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">Password</label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className={`w-full pl-10 pr-12 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      loginForm.formState.errors.password
                        ? 'border-status-invalid'
                        : 'border-border'
                    }`}
                    {...loginForm.register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border accent-primary"
                    {...loginForm.register('remember')}
                  />
                  <span className="text-xs text-muted-foreground">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || authSuccess}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCwIcon />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* SIGNUP FORM - ADMIN ONLY */}
          {mode === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-5 fade-in">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
                <Shield size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Admin Account</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Create an admin account to design tickets, manage events, and add scanner users
                    to your team.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Your full name"
                    className={`w-full pl-10 pr-4 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      signupForm.formState.errors.name ? 'border-status-invalid' : 'border-border'
                    }`}
                    {...signupForm.register('name', { required: 'Full name is required' })}
                  />
                </div>
                {signupForm.formState.errors.name && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {signupForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className={`w-full pl-10 pr-4 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      signupForm.formState.errors.email ? 'border-status-invalid' : 'border-border'
                    }`}
                    {...signupForm.register('email', {
                      required: 'Email is required',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                    })}
                  />
                </div>
                {signupForm.formState.errors.email && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {signupForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Organization Name
                </label>
                <div className="relative">
                  <Building2
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Your company or event name"
                    className={`w-full pl-10 pr-4 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      signupForm.formState.errors.orgName
                        ? 'border-status-invalid'
                        : 'border-border'
                    }`}
                    {...signupForm.register('orgName', {
                      required: 'Organization name is required',
                    })}
                  />
                </div>
                {signupForm.formState.errors.orgName && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {signupForm.formState.errors.orgName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">Password</label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className={`w-full pl-10 pr-12 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      signupForm.formState.errors.password
                        ? 'border-status-invalid'
                        : 'border-border'
                    }`}
                    {...signupForm.register('password', {
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Minimum 8 characters' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {signupForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    className={`w-full pl-10 pr-12 py-3 bg-input border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                      signupForm.formState.errors.confirmPassword
                        ? 'border-status-invalid'
                        : 'border-border'
                    }`}
                    {...signupForm.register('confirmPassword', {
                      required: 'Please confirm your password',
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {signupForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 rounded border-border accent-primary flex-shrink-0"
                    {...signupForm.register('terms', { required: 'You must accept the terms' })}
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the{' '}
                    <a href="#" className="text-primary hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {signupForm.formState.errors.terms && (
                  <p className="text-xs text-status-invalid mt-1.5">
                    {signupForm.formState.errors.terms.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <RefreshCwIcon />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Admin Account
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Demo Credentials Box */}
          {mode === 'login' && (
            <div className="mt-8 rounded-xl border border-border bg-muted/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Zap size={12} className="text-accent" />
                  Demo Accounts — Click to Autofill
                </p>
              </div>
              <div className="divide-y divide-border">
                {DEMO_CREDENTIALS.map((cred) => (
                  <div key={cred.id} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-1 rounded-md uppercase tracking-wider ${
                            cred.role === 'admin'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {cred.roleLabel}
                        </span>
                      </div>
                      <button
                        onClick={() => autofillCredentials(cred)}
                        className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                      >
                        Autofill <ChevronRight size={12} />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2.5">{cred.description}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-input rounded-lg px-3 py-2">
                        <span className="text-xs font-mono text-foreground">{cred.email}</span>
                        <button
                          onClick={() => handleCopy(cred.email, `${cred.id}-email`)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedField === `${cred.id}-email` ? (
                            <Check size={14} className="text-status-valid" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-input rounded-lg px-3 py-2">
                        <span className="text-xs font-mono text-foreground">{cred.password}</span>
                        <button
                          onClick={() => handleCopy(cred.password, `${cred.id}-pass`)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedField === `${cred.id}-pass` ? (
                            <Check size={14} className="text-status-valid" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-card/30 border-t border-border">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <QrCode size={11} className="text-accent" />
                  Scanner accounts are created by Admin from the dashboard
                </p>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-primary hover:underline font-medium"
                >
                  Create admin account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg
      className="animate-spin"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
