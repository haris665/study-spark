import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Flame,
  Target,
  BookOpen,
  HelpCircle,
  Clock,
  ArrowRight,
  Play,
  RotateCcw,
  CheckCircle2,
  FileText,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Ring } from "@/components/app/Ring";
import { useAuth } from "@/lib/auth";
import { localStore, type IncompleteSessionData } from "@/lib/local-store";
import {
  subjectsQuery,
  chaptersQuery,
  topicsQuery,
  mcqsQuery,
  attemptsQuery,
  sessionsQuery,
  profileQuery,
  notesQuery,
  reviewSchedulesQuery,
  computeStreak,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Study Spark" },
      {
        name: "description",
        content:
          "Your daily study command centre: track daily targets, review curve, and test progress.",
      },
      { property: "og:title", content: "Dashboard — Study Spark" },
      {
        property: "og:description",
        content:
          "Your daily study command centre: track daily targets, review curve, and test progress.",
      },
    ],
  }),
  component: Dashboard,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const widgetStaggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const widgetChildVariant = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const hoverCardVariant = {
  hover: {
    y: -3,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [activityTab, setActivityTab] = useState<"all" | "practice" | "notes">("all");
  const [mounted, setMounted] = useState(false);
  const [incompleteSession, setIncompleteSession] = useState<IncompleteSessionData | null>(null);

  useEffect(() => {
    setMounted(true);
    setIncompleteSession(localStore.getIncompleteSession());
  }, []);

  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: topics = [] } = useQuery({ ...topicsQuery(), enabled: !!user });
  const { data: mcqs = [] } = useQuery({ ...mcqsQuery(), enabled: !!user });
  const { data: attempts = [] } = useQuery({ ...attemptsQuery(), enabled: !!user });
  const { data: sessions = [] } = useQuery({ ...sessionsQuery(), enabled: !!user });
  const { data: notes = [] } = useQuery({ ...notesQuery(), enabled: !!user });
  const { data: reviewSchedules = [] } = useQuery({ ...reviewSchedulesQuery(), enabled: !!user });

  // Core metrics calculation strictly from user data starting at 0
  const approvedMcqs = mcqs.filter((m) => m.status === "approved");
  const accuracy = attempts.length
    ? Math.round((attempts.filter((a) => a.is_correct).length / attempts.length) * 100)
    : 0;
  const streak = attempts.length ? computeStreak(attempts.map((a) => a.created_at)) : 0;

  // Today targets (Questions & Minutes)
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttempts = attempts.filter((a) => a.created_at?.slice(0, 10) === todayStr);
  const todaySessions = sessions.filter((s) => s.created_at?.slice(0, 10) === todayStr);
  const todayMinutesSpent = Math.round(
    todaySessions.reduce((acc, s) => acc + (s.duration_sec || 0), 0) / 60,
  );

  const questionGoal = 25;
  const minutesGoal = 45;
  const currentQuestions = todayAttempts.length;
  const questionsNeeded = Math.max(0, questionGoal - currentQuestions);

  // Target completion percentage calculation (0 to 100)
  const targetCompletionPct = Math.min(
    100,
    Math.round(
      ((currentQuestions / questionGoal + (todayMinutesSpent || 0) / minutesGoal) / 2) * 100,
    ),
  );

  // Spaced repetition due count
  const nowIso = new Date().toISOString();
  const dueReviews = reviewSchedules.filter((r) => r.due_at <= nowIso && !r.is_suspended);
  const dueCount = dueReviews.length;

  // Overall Syllabus coverage
  const totalTopics = topics.length;
  const completedTopics = topics.filter((t) => t.completion === "completed").length;
  const syllabusCoveragePct =
    totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  // Dynamic next recommended item if no active session
  const nextRecommendedTopic =
    topics.find((t) => t.completion !== "completed") || topics[0] || null;
  const topicChapter = chapters.find((c) => c.id === nextRecommendedTopic?.chapter_id);
  const topicSubject = subjects.find((s) => s.id === topicChapter?.subject_id);

  const firstName =
    profile?.display_name?.split(/[\s@]/)[0] || user?.email?.split("@")[0] || "Scholar";

  const dateFormatted = mounted
    ? new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Today";

  // Build Real Recent Activity List (Drills + Notes)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  const recentActivities = [
    ...sortedSessions.slice(0, 5).map((s) => {
      const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
      const modeLabel =
        s.mode === "test" || s.mode === "exam" ? "Test" : s.mode === "timed" ? "Timed" : "Practice";
      const badgeStyle =
        modeLabel === "Test"
          ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shadow-[0_0_10px_rgba(99,102,241,0.15)]"
          : modeLabel === "Timed"
            ? "bg-amber-500/15 text-amber-400 border border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]";
      return {
        id: s.id,
        timestamp: new Date(s.created_at).getTime(),
        type: "drill" as const,
        badge: modeLabel,
        badgeStyle,
        title: `${s.correct} / ${s.total} correct (${pct}%)`,
        subtitle: `${s.mode.toUpperCase()} session`,
        time: mounted
          ? new Date(s.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : s.created_at.slice(0, 10),
        action: "Retry",
        to: "/practice",
      };
    }),
    ...sortedNotes.slice(0, 4).map((n) => ({
      id: n.id,
      timestamp: new Date(n.updated_at).getTime(),
      type: "note" as const,
      badge: "Note",
      badgeStyle:
        "bg-sky-500/15 text-sky-400 border border-sky-500/25 shadow-[0_0_10px_rgba(14,165,233,0.15)]",
      title: n.title,
      subtitle: `${n.word_count || 0} words`,
      time: mounted
        ? new Date(n.updated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : n.updated_at.slice(0, 10),
      action: "Open",
      to: "/notes",
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const filteredActivities = recentActivities.filter((a) => {
    if (activityTab === "practice") return a.type === "drill";
    if (activityTab === "notes") return a.type === "note";
    return true;
  });

  return (
    <AppShell title="Dashboard" subtitle="Study OS Command Centre">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="dashboard-page space-y-6 max-w-7xl mx-auto pb-12"
      >
        {/* 1. Header with greeting, streak aura, and quick practice launch */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              Ready to study, {firstName}.
            </h1>
            <p className="mt-1 text-sm text-zinc-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
                <Flame className="size-4 animate-pulse text-amber-400" />
                {streak} {streak === 1 ? "day" : "days"} streak
              </span>
              <span>·</span>
              <span>{dueCount} items due for review today</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface/80 px-3.5 py-2 text-xs font-medium text-zinc-300 backdrop-blur-md shadow-xs">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              Cloud synced
            </div>
            <Link to="/practice">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-all cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.25)] hover:shadow-[0_0_28px_rgba(234,179,8,0.4)]"
              >
                <span>Start practice</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* 2. Daily target track Card with Glowing Aura */}
        <motion.div
          variants={itemVariants}
          className="dashboard-hero relative rounded-[1.7rem] border border-amber-500/20 bg-gradient-to-br from-surface via-surface/90 to-surface-2/80 p-6 sm:p-7 overflow-hidden backdrop-blur-md shadow-[0_0_35px_-10px_rgba(234,179,8,0.1)] transition-all duration-300 hover:border-amber-500/35 hover:shadow-[0_0_45px_-5px_rgba(234,179,8,0.18)]"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 size-60 rounded-full bg-amber-600/5 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-400 tracking-wider uppercase">
                  <Sparkles className="size-3" />
                  Daily target track · {dateFormatted}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">
                {questionsNeeded > 0
                  ? `Answer ${questionsNeeded} more question${questionsNeeded === 1 ? "" : "s"} to hit today's target.`
                  : "🎉 Today's daily target accomplished!"}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                You're at <strong className="text-foreground font-mono">{currentQuestions}</strong>{" "}
                of {questionGoal} questions and{" "}
                <strong className="text-foreground font-mono">{todayMinutesSpent}</strong> of{" "}
                {minutesGoal} minutes —{" "}
                {currentQuestions === 0
                  ? "start your first practice drill to ignite your progress."
                  : "keep the streak alive!"}
              </p>
            </div>

            <div className="flex items-center gap-5 shrink-0 bg-surface-2/60 rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs">
              <div className="relative grid place-items-center">
                <Ring value={targetCompletionPct} size={78} stroke={7} color="#7CE0D3" />
                <span className="absolute font-mono text-sm font-bold text-foreground">
                  {targetCompletionPct}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground tracking-wide">
                  Today's target
                </p>
                <p className="text-xs text-zinc-400 font-mono">
                  <span className="text-amber-400 font-semibold">{currentQuestions}</span>/
                  {questionGoal} Qs
                </p>
                <p className="text-xs text-zinc-400 font-mono">
                  <span className="text-zinc-200 font-semibold">{todayMinutesSpent}</span>/
                  {minutesGoal}m
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 3. Metrics 4-Column Bar with Staggered Card Entrances */}
        <motion.div
          variants={widgetStaggerContainer}
          initial="hidden"
          animate="visible"
          className="dashboard-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-[1.45rem] border border-border/80 bg-surface/70 backdrop-blur-md divide-y sm:divide-y-0 sm:divide-x divide-border/70 overflow-hidden shadow-xs"
        >
          {/* Stat 1: Study streak */}
          <motion.div
            variants={widgetChildVariant}
            className="p-5 sm:p-6 group hover:bg-surface-2/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-400">Study streak</p>
              <Flame
                className={`size-4 ${streak > 0 ? "text-amber-400 animate-pulse" : "text-zinc-600"} transition-colors`}
              />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                {streak}
              </p>
              <span className="text-xs font-semibold text-zinc-400">
                {streak === 1 ? "day" : "days"}
              </span>
            </div>
            {streak === 0 ? (
              <p className="mt-1 text-xs text-amber-400/90 font-medium flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
                Practice today to start streak
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Active consistency run</p>
            )}
          </motion.div>

          {/* Stat 2: Accuracy */}
          <motion.div
            variants={widgetChildVariant}
            className="p-5 sm:p-6 group hover:bg-surface-2/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-400">Accuracy</p>
              <TrendingUp className="size-4 text-emerald-400 transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                {attempts.length > 0 ? `${accuracy}%` : "—"}
              </p>
              {attempts.length === 0 && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Ready to test
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-mono">
              {attempts.length > 0
                ? `${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"} logged`
                : "No drills attempted yet"}
            </p>
          </motion.div>

          {/* Stat 3: Question bank */}
          <motion.div variants={widgetChildVariant}>
            <Link
              to="/question-bank"
              className="p-5 sm:p-6 group hover:bg-surface-2/50 transition-colors block relative h-full"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400 group-hover:text-amber-400 transition-colors">
                  Question bank
                </p>
                <HelpCircle className="size-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                {approvedMcqs.length || mcqs.length}
              </p>
              <p className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Manage & create →
              </p>
            </Link>
          </motion.div>

          {/* Stat 4: Syllabus coverage */}
          <motion.div variants={widgetChildVariant}>
            <Link
              to="/syllabus"
              className="p-5 sm:p-6 group hover:bg-surface-2/50 transition-colors block relative h-full"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400 group-hover:text-amber-400 transition-colors">
                  Syllabus coverage
                </p>
                <BookOpen className="size-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                {syllabusCoveragePct}%
              </p>
              <p className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors font-mono">
                {completedTopics}/{totalTopics || 0} topics mastered
              </p>
            </Link>
          </motion.div>
        </motion.div>

        {/* 4. Two-Column Middle Section: Continue Studying & Spaced Repetition */}
        <motion.div variants={itemVariants} className="grid gap-5 lg:grid-cols-2">
          {/* Left Card: Continue studying */}
          <div className="rounded-2xl border border-border/80 bg-surface/70 backdrop-blur-md p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_25px_rgba(234,179,8,0.08)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <RotateCcw className="size-4 text-amber-400" />
                  Continue studying
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    incompleteSession
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                  }`}
                >
                  {incompleteSession ? "In progress" : "Ready to study"}
                </span>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-foreground">
                  {incompleteSession?.title ||
                    nextRecommendedTopic?.name ||
                    "Adaptive Practice Session"}
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  {incompleteSession
                    ? incompleteSession.subtitle
                    : nextRecommendedTopic
                      ? `${topicSubject?.name || "Syllabus"} · ${topicChapter?.name || "General Chapter"}`
                      : "Strengthen memory with customized multi-subject drills."}
                </p>
              </div>

              {/* Slender Amber Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>Progress</span>
                  <span>
                    {incompleteSession
                      ? `${incompleteSession.currentIdx} / ${incompleteSession.total} Qs`
                      : "0% complete"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: incompleteSession
                        ? `${Math.round((incompleteSession.currentIdx / incompleteSession.total) * 100)}%`
                        : "0%",
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
              <span className="text-zinc-500 font-mono" suppressHydrationWarning>
                {incompleteSession && mounted
                  ? `Last active ${new Date(incompleteSession.updatedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : "Instant start"}
              </span>
              <Link to="/practice">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="font-medium text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-amber-400/10"
                >
                  <span>{incompleteSession ? "Resume session" : "Start session"}</span>
                  <ArrowRight className="size-3.5" />
                </motion.button>
              </Link>
            </div>
          </div>

          {/* Right Card: Spaced repetition review */}
          <div className="rounded-2xl border border-border/80 bg-surface/70 backdrop-blur-md p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_25px_rgba(234,179,8,0.08)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Target className="size-4 text-rose-400" />
                  Spaced repetition review
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    dueCount > 0
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/25 shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                  }`}
                >
                  {dueCount > 0 ? `${dueCount} due` : "0 due"}
                </span>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed">
                {dueCount > 0
                  ? "Flashcards and questions scheduled for consolidation along the Leitner forgetting curve."
                  : "All caught up! No scheduled spaced-repetition items due for review right now."}
              </p>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-400">Estimated duration</span>
                <span className="text-zinc-300 font-mono">
                  ~{dueCount > 0 ? Math.ceil(dueCount * 1.5) : 0} min
                </span>
              </div>
            </div>

            <div>
              <Link to="/practice">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-all cursor-pointer shadow-[0_0_18px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.35)]"
                >
                  <span>{dueCount > 0 ? "Review due items" : "Start drill review"}</span>
                  <ArrowRight className="size-4" />
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* 5. Bottom Card: Recent Activity with Animated Tabs & Real Records */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-border/80 bg-surface/70 backdrop-blur-md p-6 space-y-4 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Recent activity</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Your latest practice drills and study notes
              </p>
            </div>

            {/* Filter Tabs with Sliding Motion Indicator */}
            <div className="relative inline-flex items-center rounded-xl bg-surface-2/80 p-1 border border-border/60">
              {(["all", "practice", "notes"] as const).map((tab) => {
                const label = tab === "all" ? "All" : tab === "practice" ? "Drills" : "Notes";
                const isSelected = activityTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActivityTab(tab)}
                    className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? "text-zinc-950 font-semibold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activityTabIndicator"
                        className="absolute inset-0 bg-amber-400 rounded-lg shadow-xs"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-20">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-1">
            <AnimatePresence mode="wait">
              {filteredActivities.length === 0 ? (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="py-10 text-center rounded-2xl border border-dashed border-border/80 bg-surface-2/30 p-6 sm:p-8 space-y-4 relative overflow-hidden"
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5"
                  >
                    <Clock className="size-6" />
                  </motion.div>

                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-foreground">
                      No study activity logged yet
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
                      Complete your first practice test or record study notes to build your live
                      revision analytics and performance history.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <Link to="/practice">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 px-4 py-2 text-xs font-bold cursor-pointer shadow-sm transition-all"
                      >
                        <Play className="size-3.5 fill-zinc-950" /> Start Practice Drill
                      </motion.button>
                    </Link>

                    <Link to="/question-bank">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface/80 px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition-colors cursor-pointer shadow-xs"
                      >
                        <HelpCircle className="size-3.5 text-amber-400" /> Explore Question Bank
                      </motion.button>
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={activityTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="divide-y divide-border/60"
                >
                  {filteredActivities.map((act) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="py-3.5 flex items-center justify-between first:pt-1 last:pb-1 group hover:bg-surface-2/30 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 ${act.badgeStyle}`}
                        >
                          {act.badge}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {act.title}
                          </p>
                          <p
                            className="text-xs text-zinc-500 font-mono mt-0.5"
                            suppressHydrationWarning
                          >
                            {act.subtitle} · {act.time}
                          </p>
                        </div>
                      </div>

                      <Link to={act.to} className="shrink-0 ml-3">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          className="text-xs text-zinc-300 hover:text-amber-400 hover:bg-surface-2 px-3 py-1.5 rounded-lg border border-border/80 transition-colors cursor-pointer"
                        >
                          {act.action} →
                        </motion.button>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
