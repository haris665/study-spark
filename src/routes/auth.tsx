import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { gsap } from "gsap";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { StudySparkLogo } from "@/components/app/StudySparkLogo";
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Shield,
  Fingerprint,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — StudySpark OS" },
      {
        name: "description",
        content:
          "Sign in to StudySpark OS to access your syllabus, MCQ question bank, and analytics.",
      },
      { property: "og:title", content: "Sign in — StudySpark OS" },
      {
        property: "og:description",
        content: "Secure, encrypted cloud authentication for your study workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".auth-premium-item",
        { autoAlpha: 0, y: 18, filter: "blur(8px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.055,
        },
      );
    }, cardRef);

    return () => ctx.revert();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && !user.isGuest && !authSuccess) {
      navigate({ to: "/" });
    }
  }, [user, loading, navigate, authSuccess]);

  // Cybersecurity password strength calculator
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: "Weak", color: "bg-red-500" };
      case 2:
        return { score: 50, label: "Fair", color: "bg-amber-500" };
      case 3:
        return { score: 75, label: "Good", color: "bg-blue-500" };
      case 4:
        return { score: 100, label: "Strong & Secure", color: "bg-emerald-500" };
      default:
        return { score: 15, label: "Too Short", color: "bg-red-400" };
    }
  }, [password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please provide both email and password.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await signUpWithEmail(email.trim(), password, name.trim());
        if (res.error) throw new Error(res.error);
        if (res.requiresEmailConfirmation) {
          toast.success("Account created. Check your email to confirm your address, then sign in.");
          setBusy(false);
          setMode("signin");
          return;
        }
        setAuthSuccess(true);
        toast.success("Account created successfully! Initializing workspace…");
        setTimeout(() => navigate({ to: "/" }), 800);
      } else {
        const res = await signInWithEmail(email.trim(), password);
        if (res.error) throw new Error(res.error);
        setAuthSuccess(true);
        toast.success("Welcome back! Signing in…");
        setTimeout(() => navigate({ to: "/" }), 800);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      if (res.redirected && !res.user) {
        toast.success("Opening Google sign-in...");
        return;
      }
      setAuthSuccess(true);
      toast.success("Authenticated with Google! Entering workspace…");
      setTimeout(() => navigate({ to: "/" }), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google authentication error");
      setBusy(false);
    }
  }

  function handleInstantDemo() {
    setBusy(true);
    toast.success("Launching StudySpark instant demo session!");
    setTimeout(() => {
      navigate({ to: "/" });
    }, 400);
  }

  return (
    <div className="auth-page relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4 py-12 selection:bg-accent/30 selection:text-foreground">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--amber) 0%, transparent 70%)" }}
      />

      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="auth-card relative z-10 w-full max-w-md rounded-[1.75rem] border border-border-2 bg-surface/85 p-7 shadow-2xl backdrop-blur-xl sm:p-9"
      >
        {/* Brand header */}
        <div className="auth-premium-item flex items-center justify-between">
          <StudySparkLogo variant="full" size="md" />
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono text-emerald-400">
            <ShieldCheck className="size-3.5" />
            <span>Encrypted</span>
          </div>
        </div>

        <div className="auth-premium-item mt-7">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {mode === "signin" ? "Welcome back" : "Create your workspace"}
          </h2>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            {mode === "signin"
              ? "Sign in to sync your syllabus, flashcards, MCQ banks, and study analytics."
              : "Set up your personal learning headquarters with automated daily practice tests."}
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="auth-premium-item mt-5 grid grid-cols-2 rounded-xl border border-border bg-surface-2/60 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`relative rounded-lg py-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              mode === "signin" ? "text-foreground shadow-xs" : "text-muted hover:text-foreground"
            }`}
          >
            {mode === "signin" && (
              <motion.div
                layoutId="authModeIndicator"
                className="absolute inset-0 rounded-lg bg-surface border border-border-2"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">Sign in</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`relative rounded-lg py-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              mode === "signup" ? "text-foreground shadow-xs" : "text-muted hover:text-foreground"
            }`}
          >
            {mode === "signup" && (
              <motion.div
                layoutId="authModeIndicator"
                className="absolute inset-0 rounded-lg bg-surface border border-border-2"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">Create account</span>
          </button>
        </div>

        {/* Google OAuth button */}
        <div className="auth-premium-item mt-5">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy || authSuccess}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border-2 bg-surface-2/90 px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground shadow-xs transition hover:bg-surface-3 disabled:opacity-60 cursor-pointer"
          >
            <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
              />
            </svg>
            <span>Continue with Google</span>
          </motion.button>
        </div>

        {/* Instant Demo Session button */}
        <div className="auth-premium-item mt-2.5">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleInstantDemo}
            disabled={busy || authSuccess}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15 disabled:opacity-60 cursor-pointer"
          >
            <Zap className="size-3.5" />
            <span>Instant Demo Session (Guest Mode)</span>
          </motion.button>
        </div>

        {/* Divider */}
        <div className="auth-premium-item my-5 flex items-center gap-3 text-center text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            or credentials
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={submit} className="auth-premium-item space-y-3.5">
          <AnimatePresence mode="wait">
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-medium text-muted mb-1">
                  Full name / Display name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Hunter"
                    className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 pl-10 pr-3.5 text-xs sm:text-sm text-foreground placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 pl-10 pr-3.5 text-xs sm:text-sm text-foreground placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-muted">Password</label>
              {mode === "signin" && (
                <span className="font-mono text-[10px] text-faint">Secured via TLS</span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 pl-10 pr-10 text-xs sm:text-sm text-foreground placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* Password strength meter in Sign Up mode */}
            {mode === "signup" && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-faint">Security level:</span>
                  <span className="font-semibold text-foreground">{passwordStrength.label}</span>
                </div>
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={busy || authSuccess}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs sm:text-sm font-bold text-accent-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {authSuccess ? (
              <>
                <CheckCircle2 className="size-4 animate-bounce" />
                <span>Success! Redirecting…</span>
              </>
            ) : busy ? (
              <span>Authenticating…</span>
            ) : mode === "signin" ? (
              <>
                <span>Sign in to Workspace</span>
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <span>Create Study Account</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Cybersecurity Guarantee Footer */}
        <div className="auth-premium-item mt-6 rounded-xl border border-border/70 bg-surface-2/40 p-3 text-[11px] text-muted space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Fingerprint className="size-3.5 text-accent" />
            <span>Cybersecurity Architecture</span>
          </div>
          <p className="text-[10px] leading-relaxed text-faint">
            Credentials are encrypted in-flight with TLS 1.3 and hashed using PBKDF2/Bcrypt. We
            never log, share, or store passwords in plaintext.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
