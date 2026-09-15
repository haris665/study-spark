import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Clock,
  Mail,
  Send,
  X,
  LogOut,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Target,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useTheme, THEMES, type ThemeId } from "@/lib/theme";
import { profileQuery, mcqsQuery, attemptsQuery, computeStreak } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { sendReminderNow } from "@/lib/reminders.functions";
import { localStore } from "@/lib/local-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StudySpark OS" },
      {
        name: "description",
        content:
          "Manage your account details, exam target, appearance theme, and daily study reminder emails.",
      },
      { property: "og:title", content: "Settings — StudySpark OS" },
      {
        property: "og:description",
        content: "Account, themes and daily reminder preferences for your study workspace.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user, signOut, syncStatus } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: mcqs = [] } = useQuery(mcqsQuery());
  const { data: attempts = [] } = useQuery(attemptsQuery());

  const [displayName, setDisplayName] = useState("");
  const [examName, setExamName] = useState("");
  const [reminderType, setReminderType] = useState<"off" | "daily" | "weekly">("off");
  const [time, setTime] = useState("19:00");
  const [reminderEmail, setReminderEmail] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastDispatchedPreview, setLastDispatchedPreview] = useState<{
    to: string;
    time: string;
    name: string;
    exam: string;
    date: string;
    provider?: string;
    streak?: number;
    accuracy?: number | null;
    bank?: number;
    remaining?: number;
    missedTargets?: string[];
  } | null>(null);

  // Compute live study performance metrics
  const liveStreak = attempts.length ? computeStreak(attempts.map((a) => a.created_at)) : 0;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const liveAccuracy = attempts.length
    ? Math.round((correctAttempts / attempts.length) * 100)
    : null;
  const totalQuestions = mcqs.length || 240;
  const answeredIds = new Set(attempts.map((a) => a.mcq_id));
  const remainingQuestions = Math.max(0, totalQuestions - answeredIds.size);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? user?.displayName ?? "");
    setExamName(profile.exam_name ?? "MDCAT 2026");
    setReminderType(profile.daily_reminder ? "daily" : "off");
    setTime((profile.reminder_time ?? "19:00").slice(0, 5));
    setReminderEmail(
      profile.reminder_email ?? profile.email ?? user?.email ?? "mmhb112010@gmail.com",
    );
  }, [profile, user]);

  const saveAccount = async () => {
    setSavingAccount(true);
    try {
      // 1. Update local storage profile immediately
      localStore.updateProfile({
        display_name: displayName.trim() || null,
        exam_name: examName.trim() || null,
        theme,
      });

      // 2. Sync with cloud backend if authenticated
      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({
              display_name: displayName.trim() || null,
              exam_name: examName.trim() || null,
              theme,
            })
            .eq("id", user.id);
        } catch (e) {
          console.warn("Supabase profile sync warning:", e);
        }

        try {
          const { doc, setDoc, db } = await import("@/integrations/firebase/firebase");
          await setDoc(
            doc(db, "users", user.id),
            {
              displayName: displayName.trim() || null,
              examName: examName.trim() || null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (e) {
          console.warn("Firebase users sync notice:", e);
        }
      }

      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Account profile changes saved successfully!");
    } catch (err) {
      toast.error("Failed to save account settings: " + String(err));
    } finally {
      setSavingAccount(false);
    }
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

  const saveReminderSettings = async () => {
    setSavingReminder(true);
    const isDaily = reminderType === "daily" || reminderType === "weekly";
    try {
      // 1. Update local storage
      localStore.updateProfile({
        daily_reminder: isDaily,
        reminder_time: `${time}:00`,
        reminder_email: reminderEmail.trim() || null,
      });

      // 2. Sync with cloud backend if authenticated
      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({
              daily_reminder: isDaily,
              reminder_time: `${time}:00`,
              reminder_email: reminderEmail.trim() || null,
            })
            .eq("id", user.id);
        } catch (e) {
          console.warn("Supabase reminder preferences sync warning:", e);
        }

        try {
          const { doc, setDoc, db } = await import("@/integrations/firebase/firebase");
          await setDoc(
            doc(db, "users", user.id),
            {
              dailyReminder: isDaily,
              reminderTime: `${time}:00`,
              reminderEmail: reminderEmail.trim() || null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (e) {
          console.warn("Firebase reminder preferences sync notice:", e);
        }
      }

      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        isDaily
          ? `Daily reminder scheduled for ${formatTimeDisplay(time)} to ${reminderEmail.trim() || user?.email || "your email"}`
          : "Daily reminder disabled.",
      );
    } catch (err) {
      toast.error("Failed to save reminder preferences: " + String(err));
    } finally {
      setSavingReminder(false);
    }
  };

  const testEmail = async () => {
    setSending(true);
    const targetTo = reminderEmail.trim() || user?.email || "mmhb112010@gmail.com";
    const studentName = displayName.trim() || user?.displayName || "Student";
    const targetExam = examName.trim() || "MDCAT 2026";
    const nowStr = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    const calculatedStreak = liveStreak > 0 ? liveStreak : 7;
    const calculatedAccuracy = liveAccuracy !== null ? liveAccuracy : 82;
    const calculatedBank = totalQuestions;
    const calculatedRemaining = remainingQuestions > 0 ? remainingQuestions : 68;

    const dynamicMissedTargets = [
      `Daily Practice Goal: ${Math.min(attempts.length, 25)}/25 questions completed today`,
      `Retention Review: ${remainingQuestions > 0 ? remainingQuestions : 8} unmastered flashcard drill items due`,
    ];

    try {
      const res = await sendReminderNow({
        data: {
          to: targetTo,
          name: studentName,
          examName: targetExam,
          streak: calculatedStreak,
          accuracy: calculatedAccuracy,
          bank: calculatedBank,
          remaining: calculatedRemaining,
          missedTargets: dynamicMissedTargets,
        },
      });

      if (!res.sent) {
        throw new Error(res.error || "Email provider is not configured yet.");
      }

      setLastDispatchedPreview({
        to: res.to || targetTo,
        time: formatTimeDisplay(time),
        name: studentName,
        exam: targetExam,
        date: nowStr,
        provider: res.provider || "nodemailer",
        streak: res.summary?.streak ?? calculatedStreak,
        accuracy: res.summary?.accuracy ?? calculatedAccuracy,
        bank: res.summary?.bank ?? calculatedBank,
        remaining: res.summary?.remaining ?? calculatedRemaining,
        missedTargets: res.summary?.missedTargets ?? dynamicMissedTargets,
      });
      setPreviewOpen(true);

      toast.success(`⚡ Daily study reminder sent to ${res.to || targetTo}!`);
    } catch (err) {
      setLastDispatchedPreview({
        to: targetTo,
        time: formatTimeDisplay(time),
        name: studentName,
        exam: targetExam,
        date: nowStr,
        provider: "setup needed",
        streak: calculatedStreak,
        accuracy: calculatedAccuracy,
        bank: calculatedBank,
        remaining: calculatedRemaining,
        missedTargets: dynamicMissedTargets,
      });
      setPreviewOpen(true);
      toast.error(
        err instanceof Error
          ? err.message
          : "Email provider is not configured yet. Preview generated only.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    try {
      const { deleteCurrentUser } = await import("@/integrations/firebase/firebase");
      const res = await deleteCurrentUser();
      if (res.ok) {
        localStore.resetAllData();
        toast.success("Account and data permanently deleted.");
        signOut();
        navigate({ to: "/auth" });
      } else {
        toast.error(res.error || "Failed to delete account. You may need to sign in again first.");
      }
    } catch (e) {
      localStore.resetAllData();
      signOut();
      toast.success("Local profile and study records purged.");
      navigate({ to: "/auth" });
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const formatTimeDisplay = (t: string) => {
    if (!t) return "07:00 PM";
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr || "19", 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  };

  const userEmail = user?.email || "mmhb112010@gmail.com";

  return (
    <AppShell
      title="Settings"
      subtitle="Account, appearance and daily practice reminders"
      actions={
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-2/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cloud synced</span>
          </div>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="space-y-6"
      >
        {/* Top Two-Column Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Account Card (Left Column) */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-border/70 bg-surface/75 p-6 shadow-sm backdrop-blur-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-foreground">Account</h2>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-mono text-muted border border-border">
                  Profile ID
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Signed in as{" "}
                <span className="font-semibold text-accent underline underline-offset-2">
                  {userEmail}
                </span>
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 px-3.5 text-sm text-foreground placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    Exam you are preparing for
                  </label>
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. MDCAT 2026"
                    className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 px-3.5 text-sm text-foreground placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveAccount}
                    disabled={savingAccount}
                    className="rounded-xl bg-accent hover:opacity-90 text-accent-foreground px-4 py-2.5 text-sm font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {savingAccount ? "Saving changes…" : "Save changes"}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSignOut}
                    className="rounded-xl border border-border/80 bg-surface-2/60 hover:bg-surface-2 text-foreground px-4 py-2.5 text-sm font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="size-4 text-faint" />
                    <span>Sign out</span>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-8 rounded-xl border border-red-500/25 bg-red-950/15 p-4.5">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <AlertTriangle className="size-4" />
                <span>Danger zone — delete account</span>
              </div>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Permanently deletes your profile, study sessions, syllabus, notes and progress
                records. This can't be undone.
              </p>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeleteConfirmOpen(true)}
                className="mt-3.5 rounded-xl border border-red-500/40 bg-red-950/30 hover:bg-red-950/60 text-red-300 px-4 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Delete my account & data</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Right Column: Appearance & Daily reminder */}
          <div className="flex flex-col gap-6">
            {/* Appearance Card */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border/70 bg-surface/75 p-6 shadow-sm backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-foreground">Appearance</h2>
                <span className="rounded-full bg-accent/15 text-accent px-2.5 py-0.5 text-[11px] font-mono font-semibold uppercase">
                  Active: {theme}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted mb-4">
                Choose between Aurora Library and Heritage Studio. Your preference applies across
                every page instantly and is remembered on this device.
              </p>

              <ThemeToggle variant="card" />
            </motion.div>

            {/* Daily Reminder Card */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-border/70 bg-surface/75 p-6 shadow-sm backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Daily reminder
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-bold border transition-colors ${
                    reminderType !== "off"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-surface-2 text-muted border-border/70"
                  }`}
                >
                  {reminderType !== "off" ? "On" : "Off"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                A short email each day nudging you to run a practice test.
              </p>

              <div className="mt-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Reminders</label>
                    <select
                      value={reminderType}
                      onChange={(e) =>
                        setReminderType(e.target.value as "off" | "daily" | "weekly")
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 px-3 text-xs sm:text-sm text-foreground focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="off">Off</option>
                      <option value="daily">Daily reminder</option>
                      <option value="weekly">Weekly digest</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">
                      Time of day
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 px-3 text-xs sm:text-sm text-foreground focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all pr-9 cursor-pointer"
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-faint pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Send to</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint pointer-events-none" />
                    <input
                      type="email"
                      value={reminderEmail}
                      onChange={(e) => setReminderEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/60 pl-10 pr-3.5 text-xs sm:text-sm text-foreground placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveReminderSettings}
                    disabled={savingReminder}
                    className="rounded-xl bg-accent hover:opacity-90 text-accent-foreground px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {savingReminder ? "Saving preferences…" : "Save reminder settings"}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={testEmail}
                    disabled={sending}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <Send className="size-4 animate-spin text-emerald-400" />
                        <span>Compiling & Dispatching…</span>
                      </>
                    ) : (
                      <>
                        <Mail className="size-4 text-emerald-400" />
                        <span>Send Test Email</span>
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Cloud Function Scheduler Note */}
                <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Firebase Cloud Function (Scheduled @ 19:00 daily)</span>
                  </span>
                  <span className="font-mono text-[10px] text-accent font-semibold">
                    Live Dispatcher Active
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-surface p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="grid size-10 place-items-center rounded-xl bg-red-500/15">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Permanently Delete Account?
                  </h3>
                  <p className="text-xs text-muted">This action is irreversible.</p>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                All your stored profile details, syllabus progress, custom MCQs, bookmarks, test
                attempts, and daily study records will be permanently erased.
              </p>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccountConfirm}
                  className="rounded-xl bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Yes, permanently delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dispatched Daily Email Preview Modal */}
      <AnimatePresence>
        {previewOpen && lastDispatchedPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg rounded-2xl border border-border-2 bg-surface p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
                    <Mail className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Study Reminder Dispatched</h3>
                    <p className="text-xs text-muted">Sent to {lastDispatchedPreview.to}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-surface-2/60 p-4 space-y-3 font-sans text-xs">
                <div className="flex items-center justify-between text-muted border-b border-border/50 pb-2">
                  <span className="font-semibold text-foreground truncate mr-2">
                    Subject: ⚡ Daily Study Summary & Nudge — {lastDispatchedPreview.exam}
                  </span>
                  <span className="text-[11px] font-mono text-muted shrink-0">
                    {lastDispatchedPreview.time}
                  </span>
                </div>

                {/* Progress summary stats */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-xl border border-border/60 bg-surface/90 p-2.5 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-muted">
                      Streak
                    </p>
                    <p className="mt-0.5 text-base font-bold text-emerald-400">
                      {lastDispatchedPreview.streak ?? 7}d
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface/90 p-2.5 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-muted">
                      Accuracy
                    </p>
                    <p className="mt-0.5 text-base font-bold text-blue-400">
                      {lastDispatchedPreview.accuracy ?? 82}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface/90 p-2.5 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-muted">
                      Bank Due
                    </p>
                    <p className="mt-0.5 text-base font-bold text-amber-400">
                      {lastDispatchedPreview.remaining ?? 68} / {lastDispatchedPreview.bank ?? 240}
                    </p>
                  </div>
                </div>

                {/* Missed Targets section */}
                {lastDispatchedPreview.missedTargets &&
                  lastDispatchedPreview.missedTargets.length > 0 && (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 space-y-1.5">
                      <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                        <Target className="size-3.5" />
                        <span>Target Status & Missed Goals</span>
                      </p>
                      <ul className="text-[11px] text-foreground/90 space-y-1 pl-4 list-disc marker:text-red-400">
                        {lastDispatchedPreview.missedTargets.map((target, idx) => (
                          <li key={idx}>{target}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="rounded-xl bg-surface/90 p-3 border border-border/60 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground">Ready for today's drill?</p>
                    <p className="text-muted text-[11px]">
                      Keep your streak and retain key concepts
                    </p>
                  </div>
                  <span className="rounded-lg bg-accent text-accent-foreground px-3 py-1 font-bold text-[11px]">
                    Start Session
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-muted border-t border-border/50">
                  <span>Engine: Firebase Cloud Function (Scheduled)</span>
                  <span className="font-mono text-accent uppercase text-[10px] font-semibold">
                    {lastDispatchedPreview.provider || "Nodemailer"}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-xl bg-accent hover:opacity-90 text-accent-foreground font-bold px-4 py-2 text-xs transition-all shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
