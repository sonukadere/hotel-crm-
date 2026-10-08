import { useState } from "react";
import {
  Hotel,
  Lock,
  ShieldCheck,
  Zap,
  Crown,
  ConciergeBell,
  TrendingUp,
  Calculator,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button, Input, Card, Badge } from "@hotel/ui";
import { login, DEMO_PROFILES, type QuickLoginProfile } from "../../services/authApi";

interface LoginScreenProps {
  onSuccess: () => void;
}

const DEFAULT_DEMO_PASSWORD = "GrandRajwada@2026";

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const performLogin = async (targetEmail: string, targetPass: string) => {
    setError("");
    setIsSubmitting(true);
    try {
      const session = await login(targetEmail.trim(), targetPass);
      onSuccess();
      window.setTimeout(() => {
        const banner = document.getElementById("session-banner");
        if (banner) {
          banner.textContent = `Signed in as ${session.user.name} (${session.user.role})`;
          banner.classList.remove("hidden");
          banner.classList.add("flex");
        }
      }, 50);
    } catch (err: any) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password or use Quick Login below.");
      return;
    }
    await performLogin(email, password);
  };

  const handleQuickLogin = async (profile: QuickLoginProfile) => {
    setSelectedRole(profile.role);
    setEmail(profile.email);
    setPassword(DEFAULT_DEMO_PASSWORD);
    await performLogin(profile.email, DEFAULT_DEMO_PASSWORD);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "SuperAdmin":
        return <Crown className="h-4 w-4 text-amber-500" />;
      case "FrontDesk":
        return <ConciergeBell className="h-4 w-4 text-sky-500" />;
      case "Manager":
        return <TrendingUp className="h-4 w-4 text-indigo-500" />;
      case "Accountant":
        return <Calculator className="h-4 w-4 text-emerald-500" />;
      case "Housekeeping":
        return <Sparkles className="h-4 w-4 text-amber-400" />;
      default:
        return <Hotel className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 flex items-center justify-center p-4 sm:p-6 py-10">
      <div className="w-full max-w-xl">
        {/* Palace Branding Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/50 mb-3 border border-amber-400/30">
            <Hotel className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
            Grand Rajwada Palace
          </h1>
          <p className="text-sm text-amber-200/70 mt-1">
            Indian Heritage Luxury PMS & CRM — Staff Portal
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-2xl border-amber-900/30 backdrop-blur-sm bg-white/95">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Secure Staff Sign In</h2>
            </div>
            <span className="text-xs text-slate-400">v2.4 Production</span>
          </div>

          {/* Quick 1-Click Demo Login Banner */}
          <div className="mb-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-orange-500/10 border border-amber-300/40 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                  <Zap className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡ Quick Demo Access</span>
                    <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded text-[10px]">Instant</span>
                  </div>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    1-Click instant sign-in without manual typing
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="gold"
                size="sm"
                isLoading={isSubmitting && selectedRole === "SuperAdmin"}
                onClick={() => {
                  const adminProfile = DEMO_PROFILES[0];
                  if (adminProfile) void handleQuickLogin(adminProfile);
                }}
                className="shadow-sm flex-shrink-0"
              >
                Instant GM Login
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {/* Manual Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="login-email"
              label="Staff Email"
              type="email"
              autoComplete="username"
              placeholder="e.g. admin@grandrajwada.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSelectedRole(null);
              }}
            />
            <Input
              id="login-password"
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                <span className="font-semibold">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="gold"
              size="lg"
              isLoading={isSubmitting && !selectedRole}
              className="w-full text-sm font-semibold tracking-wide uppercase"
            >
              {isSubmitting && !selectedRole ? "Verifying Credentials…" : "Open Front Desk"}
            </Button>
          </form>

          {/* Quick Role Selector Section */}
          <div className="mt-6 pt-5 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                Select Staff Role to Sign In:
              </span>
              <span className="text-[11px] text-slate-400">Click to enter</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_PROFILES.map((profile) => {
                const isCurrent = email.toLowerCase() === profile.email.toLowerCase();
                const isSelected = selectedRole === profile.role && isSubmitting;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleQuickLogin(profile)}
                    className={`text-left p-2.5 rounded-lg border transition-all duration-150 flex items-start gap-2.5 group ${
                      isCurrent
                        ? "border-amber-500 bg-amber-50/70 shadow-sm"
                        : "border-slate-200 hover:border-amber-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:shadow-xs transition-colors mt-0.5">
                      {getRoleIcon(profile.role)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {profile.title}
                        </span>
                        <Badge variant={profile.badgeVariant} className="text-[10px] px-1.5 py-0">
                          {profile.badge}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {profile.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {profile.email}
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="animate-spin h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent rounded-full flex-shrink-0 self-center" />
                    ) : isCurrent ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 self-center" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-amber-600 flex-shrink-0 self-center transition-colors" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-center text-[11px] text-slate-500">
              Demo accounts share default password:{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-[10px]">
                GrandRajwada@2026
              </code>
            </div>
          </div>

          {/* Footer Security Notice */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Protected by encrypted session & role-based access control</span>
          </div>
        </Card>
      </div>
    </div>
  );
}