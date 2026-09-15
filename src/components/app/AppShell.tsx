import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { profileQuery, mcqsQuery, attemptsQuery, computeStreak } from "@/lib/queries";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { StudySparkLogo } from "@/components/app/StudySparkLogo";
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  FileText,
  CheckCircle2,
  BarChart2,
  QrCode,
  Sparkles,
  Settings as SettingsIcon,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
  Flame,
  Menu,
  X,
  User,
  ChevronRight,
} from "lucide-react";

// The complete, ordered list of pages requested by the user
const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/syllabus", label: "Syllabus", icon: BookOpen },
  { to: "/question-bank", label: "Question Bank", icon: CheckSquare, badgeKey: "pending" },
  { to: "/notes", label: "Notes & Study", icon: FileText },
  { to: "/practice", label: "Practice & Test", icon: CheckCircle2 },
  { to: "/analytics", label: "Analytics & Progress", icon: BarChart2 },
  { to: "/scanner", label: "QR Scanner", icon: QrCode },
  { to: "/ai-studio", label: "AI Studio", icon: Sparkles },
];

export function AppShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { user, signOut, syncStatus, retrySync } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const { data: profile } = useQuery({
    ...profileQuery(user?.id),
    enabled: !!user?.id,
  });

  const { data: pending } = useQuery({
    ...mcqsQuery({ status: "pending" }),
    enabled: !!user?.id,
  });

  const { data: attempts = [] } = useQuery({
    ...attemptsQuery(),
    enabled: !!user?.id,
  });

  const streak = attempts.length ? computeStreak(attempts.map((a) => a.created_at)) : 0;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (reduceMotion || !pageRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".app-page-motion > *",
        { autoAlpha: 0, y: 16, scale: 0.992, filter: "blur(6px)" },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.035,
        },
      );
    }, pageRef);

    return () => ctx.revert();
  }, [pathname, reduceMotion]);

  // Scheduled Daily Reminder Background Runner
  useEffect(() => {
    if (!profile?.daily_reminder || !profile?.reminder_time) return;

    const checkReminder = async () => {
      try {
        const now = new Date();
        const targetTime = (profile.reminder_time || "19:00").slice(0, 5);
        const currentHours = String(now.getHours()).padStart(2, "0");
        const currentMinutes = String(now.getMinutes()).padStart(2, "0");
        const currentTimeStr = `${currentHours}:${currentMinutes}`;
        const todayStr = now.toISOString().slice(0, 10);

        const lastSentKey = `studyspark_last_reminder_${profile.id || "default"}`;
        const lastSentDate =
          typeof window !== "undefined" ? localStorage.getItem(lastSentKey) : null;

        if (currentTimeStr === targetTime && lastSentDate !== todayStr) {
          if (typeof window !== "undefined") {
            localStorage.setItem(lastSentKey, todayStr);
          }
          const { sendReminderNow } = await import("@/lib/reminders.functions");
          const targetEmail = profile.reminder_email || profile.email || undefined;
          const res = await sendReminderNow({
            data: {
              to: targetEmail,
              name: profile.display_name || undefined,
              examName: profile.exam_name || undefined,
            },
          });
          toast.success(
            `⚡ Daily study reminder dispatched for ${targetTime} to ${res.to || targetEmail || "your email"}`,
          );
        }
      } catch (err) {
        console.warn("Scheduled reminder error:", err);
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 30000);
    return () => clearInterval(interval);
  }, [
    profile?.daily_reminder,
    profile?.reminder_time,
    profile?.reminder_email,
    profile?.display_name,
    profile?.exam_name,
    profile?.id,
    profile?.email,
  ]);

  const handleRetry = async () => {
    setRetrying(true);
    await retrySync();
    setRetrying(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully. Choose an account to sign in.");
      navigate({ to: "/auth" });
    } catch {
      navigate({ to: "/auth" });
    }
  };

  const initials = (profile?.display_name ?? user.displayName ?? user.email ?? "SS")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const navigationContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Logo & App Name */}
        <div className="flex items-center justify-between px-2 pt-1 pb-4">
          <Link to="/" className="transition-transform duration-200 hover:scale-[1.02]">
            <StudySparkLogo variant="full" size="md" />
          </Link>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Study Streak Pill */}
        {streak > 0 && (
          <div className="mx-2 mb-3 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 shadow-xs">
            <span className="flex items-center gap-1.5">
              <Flame className="size-3.5 fill-amber-400 text-amber-400" />
              <span>Study Streak</span>
            </span>
            <span className="font-mono font-bold">{streak} days</span>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="mt-2">
          <p className="px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
            Core Modules
          </p>
          <nav className="mt-2 flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "text-foreground font-semibold shadow-xs"
                      : "text-muted hover:bg-surface-2/70 hover:text-foreground"
                  }`}
                >
                  {/* Animated Active Pill Indicator */}
                  {active && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 rounded-xl bg-surface-2 border border-border-2"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}

                  <Icon
                    className={`relative z-10 size-4 transition-colors duration-200 ${
                      active ? "text-accent" : "text-faint group-hover:text-foreground"
                    }`}
                  />
                  <span className="relative z-10 flex-1 truncate">{item.label}</span>

                  {item.badgeKey === "pending" && !!pending?.length && (
                    <span className="relative z-10 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                      {pending.length}
                    </span>
                  )}

                  {active && (
                    <span className="relative z-10 size-1.5 rounded-full bg-accent animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Preferences & System */}
        <div className="mt-5">
          <p className="px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
            System
          </p>
          <nav className="mt-2 flex flex-col gap-1">
            <Link
              to="/settings"
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                pathname.startsWith("/settings")
                  ? "text-foreground font-semibold shadow-xs"
                  : "text-muted hover:bg-surface-2/70 hover:text-foreground"
              }`}
            >
              {pathname.startsWith("/settings") && (
                <motion.div
                  layoutId="activeSidebarIndicator"
                  className="absolute inset-0 rounded-xl bg-surface-2 border border-border-2"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <SettingsIcon
                className={`relative z-10 size-4 ${
                  pathname.startsWith("/settings")
                    ? "text-accent"
                    : "text-faint group-hover:text-foreground"
                }`}
              />
              <span className="relative z-10 flex-1 truncate">Settings</span>
            </Link>

            {user.isGuest ? (
              <Link
                to="/auth"
                className="group relative flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-all hover:bg-accent/15"
              >
                <LogIn className="size-4" />
                <span className="flex-1 truncate">Sign in</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-surface-2/70 hover:text-foreground cursor-pointer"
              >
                <LogOut className="size-4 text-faint" />
                <span className="flex-1 truncate">Sign out</span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Footer User Card & Sync Status */}
      <div className="pt-4 pb-1">
        {/* Sync status indicator */}
        <div className="mb-2 flex items-center justify-between px-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Cloud Sync
          </span>
          {syncStatus === "connected" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          ) : syncStatus === "offline" ? (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
              title="Click to retry cloud connection"
            >
              <RefreshCw className={`size-2.5 ${retrying ? "animate-spin" : ""}`} />
              Offline
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] text-blue-400 border border-blue-500/20">
              Local Mode
            </span>
          )}
        </div>

        {/* User profile capsule */}
        <div className="rounded-xl border border-border/80 bg-surface-2/50 p-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-surface-3 to-surface ring-1 ring-border-2">
              <span className="font-mono text-xs font-semibold text-accent">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {profile?.display_name || user.displayName || "Demo Student"}
              </p>
              <p className="truncate font-mono text-[10px] text-faint">
                {profile?.exam_name || "MDCAT 2026"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell relative min-h-screen overflow-hidden bg-background font-body text-foreground antialiased selection:bg-accent/25 selection:text-foreground">
      <div className="pointer-events-none absolute -right-40 top-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-48 bottom-0 size-96 rounded-full bg-amber/10 blur-3xl" />
      <div className="relative mx-auto flex max-w-[1680px]">
        {/* Desktop Sticky Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border bg-surface/75 p-5 shadow-[14px_0_40px_-35px_color-mix(in_oklab,var(--foreground)_70%,transparent)] backdrop-blur-xl lg:flex">
          {navigationContent}
        </aside>

        {/* Mobile & Tablet Slide-out Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="relative h-full w-72 max-w-[85vw] border-r border-border bg-surface p-4 shadow-2xl"
              >
                {navigationContent}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 flex flex-col min-h-screen">
          {/* Guest / Offline Mode Notice */}
          {user.isGuest && !dismissBanner && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/80 px-4 py-2 text-xs text-foreground sm:px-8">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                <span>
                  <strong>Safe Local & Offline Mode:</strong> Study sessions and data are stored
                  locally on your device.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/auth"
                  className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition hover:opacity-90 shadow-xs"
                >
                  Sign in to Sync
                </Link>
                <button
                  onClick={() => setDismissBanner(true)}
                  className="text-faint hover:text-foreground cursor-pointer"
                  aria-label="Dismiss banner"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Sticky Header */}
          <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/75 px-4 py-4 backdrop-blur-xl sm:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 font-mono text-sm text-foreground ring-1 ring-border-2 hover:bg-surface-3 transition lg:hidden cursor-pointer"
            >
              <Menu className="size-4.5" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && <p className="truncate font-mono text-[11px] text-faint">{subtitle}</p>}
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <ThemeToggle variant="compact" />
              {actions}
              {syncStatus === "connected" && (
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-400 sm:inline-flex">
                  <Cloud className="size-3.5" />
                  Cloud Synced
                </span>
              )}
              {user.isGuest ? (
                <Link
                  to="/auth"
                  className="rounded-lg border border-border-2 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-3 transition hidden sm:inline-flex items-center gap-1.5"
                >
                  <LogIn className="size-3.5 text-accent" />
                  Sign in
                </Link>
              ) : (
                <div
                  title={`Signed in as ${user.email || "Student"}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-surface-3 to-surface ring-1 ring-border-2"
                >
                  <span className="text-xs font-semibold text-accent">{initials}</span>
                </div>
              )}
            </div>
          </header>

          {/* Page Body with Motion Transition */}
          <div className="flex-1 px-4 py-7 sm:px-8 sm:py-9">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={pageRef}
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="app-page-motion w-full max-w-[1400px] mx-auto"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
