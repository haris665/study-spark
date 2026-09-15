import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Target,
  ChevronDown,
  Calculator,
  X,
  Sparkles,
  BookOpen,
  Clock,
  Flame,
  Award,
  BarChart2,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/app/AppShell";
import {
  attemptsQuery,
  sessionsQuery,
  subjectsQuery,
  chaptersQuery,
  topicsQuery,
  mcqsQuery,
  notesQuery,
  reviewSchedulesQuery,
} from "@/lib/queries";
import {
  calculateExamReadinessIndex,
  calculateAccuracyMetrics,
  calculateStudyTime,
  calculateStreakAndConsistency,
  calculateSyllabusMastery,
  calculateRetentionMetrics,
  calculateSubjectPerformance,
  calculatePaceMetrics,
  diagnoseWeakTopics,
  type CalculationDetail,
} from "@/lib/analytics-engine";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & Calculation Criteria — Study Spark" },
      {
        name: "description",
        content:
          "Transparent mathematical analytics engine calculating your exam readiness, question accuracy, study time, streak, syllabus coverage, and forgetting curve.",
      },
      { property: "og:title", content: "Analytics & Calculation Criteria — Study Spark" },
      {
        property: "og:description",
        content:
          "Explore live formulas, criteria, and inputs behind every calculation with our open educational metrics engine.",
      },
    ],
  }),
  component: AnalyticsPage,
});

export interface MetricCriteriaModalData {
  title: string;
  metricKey: string;
  functionName: string;
  formula: string;
  summary: string;
  criteria: string[];
  inputs: Record<string, string | number | boolean>;
  howItMoves: string;
  recommendation: string;
  status: "excellent" | "good" | "moderate" | "needs_attention";
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("30d");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [activeCriteriaModal, setActiveCriteriaModal] = useState<MetricCriteriaModalData | null>(
    null,
  );

  // Queries for live study data
  const { data: attempts = [] } = useQuery(attemptsQuery());
  const { data: sessions = [] } = useQuery(sessionsQuery());
  const { data: subjects = [] } = useQuery(subjectsQuery());
  const { data: chapters = [] } = useQuery(chaptersQuery());
  const { data: topics = [] } = useQuery(topicsQuery());
  const { data: mcqs = [] } = useQuery(mcqsQuery());
  const { data: notes = [] } = useQuery(notesQuery());
  const { data: reviewSchedules = [] } = useQuery(reviewSchedulesQuery());

  // Subject filtering
  const filteredMcqs = useMemo(() => {
    if (selectedSubjectFilter === "all") return mcqs;
    const subChapters = chapters.filter((c) => c.subject_id === selectedSubjectFilter);
    const subChapterIds = new Set(subChapters.map((c) => c.id));
    return mcqs.filter(
      (m) =>
        m.subject_id === selectedSubjectFilter || (m.chapter_id && subChapterIds.has(m.chapter_id)),
    );
  }, [mcqs, selectedSubjectFilter, chapters]);

  const filteredMcqIds = useMemo(() => new Set(filteredMcqs.map((m) => m.id)), [filteredMcqs]);

  // Current timeframe attempts
  const filteredAttempts = useMemo(() => {
    let list = attempts;
    if (selectedSubjectFilter !== "all") {
      list = list.filter((a) => !a.mcq_id || filteredMcqIds.has(a.mcq_id));
    }
    if (timeframe === "all") return list;
    const now = Date.now();
    const daysLimit = timeframe === "7d" ? 7 : 30;
    const cutoff = now - daysLimit * 86400000;
    return list.filter((a) => new Date(a.created_at).getTime() >= cutoff);
  }, [attempts, timeframe, selectedSubjectFilter, filteredMcqIds]);

  // Prior timeframe attempts (for dynamic trend comparison)
  const priorAttempts = useMemo(() => {
    let list = attempts;
    if (selectedSubjectFilter !== "all") {
      list = list.filter((a) => !a.mcq_id || filteredMcqIds.has(a.mcq_id));
    }
    const now = Date.now();
    const daysLimit = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 60;
    const startPrior = now - daysLimit * 2 * 86400000;
    const endPrior = now - daysLimit * 86400000;
    return list.filter((a) => {
      const t = new Date(a.created_at).getTime();
      return t >= startPrior && t < endPrior;
    });
  }, [attempts, timeframe, selectedSubjectFilter, filteredMcqIds]);

  // 1. ACCURACY CALCULATION (Current vs Prior)
  const accuracyResult = useMemo(
    () => calculateAccuracyMetrics(filteredAttempts),
    [filteredAttempts],
  );

  const priorAccuracyResult = useMemo(
    () => calculateAccuracyMetrics(priorAttempts),
    [priorAttempts],
  );

  // 2. STUDY TIME CALCULATION (Current vs Prior)
  const timeframeDays = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 60;
  const studyTimeResult = useMemo(
    () => calculateStudyTime(sessions, filteredAttempts.length, timeframeDays),
    [sessions, filteredAttempts.length, timeframeDays],
  );

  const priorStudyTimeResult = useMemo(
    () => calculateStudyTime(sessions, priorAttempts.length, timeframeDays),
    [sessions, priorAttempts.length, timeframeDays],
  );

  // 3. DAILY STREAK & HABIT CONSISTENCY CALCULATION
  const streakResult = useMemo(
    () => calculateStreakAndConsistency(attempts, sessions),
    [attempts, sessions],
  );

  // 4. SYLLABUS MASTERY CALCULATION
  const filteredTopics = useMemo(() => {
    if (selectedSubjectFilter === "all") return topics;
    const subChapters = chapters.filter((c) => c.subject_id === selectedSubjectFilter);
    const subChapterIds = new Set(subChapters.map((c) => c.id));
    return topics.filter((t) => subChapterIds.has(t.chapter_id));
  }, [topics, selectedSubjectFilter, chapters]);

  const syllabusResult = useMemo(() => calculateSyllabusMastery(filteredTopics), [filteredTopics]);

  // 5. MEMORY RETENTION CALCULATION (SM-2 & EBBINGHAUS)
  const retentionResult = useMemo(
    () => calculateRetentionMetrics(reviewSchedules),
    [reviewSchedules],
  );

  // 6. COMPOSITE EXAM READINESS INDEX CALCULATION
  const examReadinessResult = useMemo(
    () =>
      calculateExamReadinessIndex(
        syllabusResult.coveragePct,
        accuracyResult.overallAccuracy,
        retentionResult.retentionPct,
        streakResult.consistencyScore,
      ),
    [
      syllabusResult.coveragePct,
      accuracyResult.overallAccuracy,
      retentionResult.retentionPct,
      streakResult.consistencyScore,
    ],
  );

  // 7. SPEED & PACING CALCULATION
  const paceResult = useMemo(() => calculatePaceMetrics(filteredAttempts), [filteredAttempts]);

  // ── Real Dynamic Trends Calculation ──────────────────────────────────────
  const attemptsTrend = useMemo(() => {
    const cur = filteredAttempts.length;
    const pri = priorAttempts.length;
    if (pri === 0) {
      if (cur === 0) return { text: "0%", sign: "neutral", label: "vs prior period" };
      return { text: `+${cur}`, sign: "up", label: "new questions" };
    }
    const pct = Math.round(((cur - pri) / pri) * 100);
    if (pct > 0) return { text: `+${pct}%`, sign: "up", label: "vs prior period" };
    if (pct < 0) return { text: `${pct}%`, sign: "down", label: "vs prior period" };
    return { text: "0%", sign: "neutral", label: "vs prior period" };
  }, [filteredAttempts.length, priorAttempts.length]);

  const accuracyTrend = useMemo(() => {
    const cur = accuracyResult.overallAccuracy;
    const pri = priorAccuracyResult.overallAccuracy;
    if (filteredAttempts.length === 0) {
      return { text: "0%", sign: "neutral", label: "no drills yet" };
    }
    if (priorAttempts.length === 0) {
      return { text: `${cur}%`, sign: "neutral", label: "initial baseline" };
    }
    const delta = Math.round(cur - pri);
    if (delta > 0) return { text: `+${delta}%`, sign: "up", label: "vs prior period" };
    if (delta < 0) return { text: `${delta}%`, sign: "down", label: "vs prior period" };
    return { text: "0%", sign: "neutral", label: "vs prior period" };
  }, [
    accuracyResult.overallAccuracy,
    priorAccuracyResult.overallAccuracy,
    filteredAttempts.length,
    priorAttempts.length,
  ]);

  const studyTimeTrend = useMemo(() => {
    const curH = studyTimeResult.totalHours ?? 0;
    const priH = priorStudyTimeResult.totalHours ?? 0;
    if (curH === 0 && priH === 0) {
      return { text: "0h", sign: "neutral", label: "vs prior period" };
    }
    if (priH === 0) {
      return { text: `+${curH}h`, sign: "up", label: "vs prior period" };
    }
    const pct = Math.round(((curH - priH) / priH) * 100);
    if (pct > 0) return { text: `+${pct}%`, sign: "up", label: "vs prior period" };
    if (pct < 0) return { text: `${pct}%`, sign: "down", label: "vs prior period" };
    return { text: "0%", sign: "neutral", label: "vs prior period" };
  }, [studyTimeResult.totalHours, priorStudyTimeResult.totalHours]);

  const streakTrend = useMemo(() => {
    const streak = streakResult.currentStreak;
    if (streak === 0) return { text: "0 days", sign: "neutral", label: "streak reset" };
    if (streak >= 7) return { text: `+${streak}d`, sign: "up", label: "habit formed" };
    return { text: `${streak}d`, sign: "up", label: "active streak" };
  }, [streakResult.currentStreak]);

  // Study time formatted label
  const studyTimeLabel = useMemo(() => {
    const rawHours = studyTimeResult.totalHours ?? 0;
    const hours = Math.floor(rawHours);
    const minutes = Math.round((rawHours % 1) * 60);
    return `${hours}h ${minutes}m`;
  }, [studyTimeResult.totalHours]);

  // ── Accuracy Over Time Real Chart Data ──────────────────────────────────
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { questions: number; correct: number }>();
    filteredAttempts.forEach((a) => {
      const dateKey = a.created_at.slice(0, 10);
      const cur = dailyMap.get(dateKey) || { questions: 0, correct: 0 };
      cur.questions += 1;
      if (a.is_correct) cur.correct += 1;
      dailyMap.set(dateKey, cur);
    });

    const daysCount = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 14;
    const result: { date: string; accuracy: number; questions: number }[] = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const stats = dailyMap.get(dateKey);

      let accuracy = 0;
      let questions = 0;
      if (stats && stats.questions > 0) {
        questions = stats.questions;
        accuracy = Math.round((stats.correct / stats.questions) * 100);
      }

      result.push({
        date: dayLabel,
        accuracy,
        questions,
      });
    }

    return result;
  }, [filteredAttempts, timeframe]);

  const hasChartActivity = useMemo(() => {
    return chartData.some((d) => d.questions > 0);
  }, [chartData]);

  // ── Real Subject Performance Bars ───────────────────────────────────────
  const subjectBarsData = useMemo(() => {
    const SUBJECT_META: Record<string, { icon: string; barClass: string; bgClass: string }> = {
      Mathematics: {
        icon: "Σ",
        barClass: "bg-indigo-500",
        bgClass: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
      },
      Physics: {
        icon: "⚡",
        barClass: "bg-emerald-500",
        bgClass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
      },
      Chemistry: {
        icon: "🧪",
        barClass: "bg-rose-500",
        bgClass: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
      },
      Biology: {
        icon: "🧬",
        barClass: "bg-teal-500",
        bgClass: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",
      },
      "Computer Science": {
        icon: "💻",
        barClass: "bg-sky-500",
        bgClass: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",
      },
      English: {
        icon: "Aa",
        barClass: "bg-blue-500",
        bgClass: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
      },
      Islamiat: {
        icon: "🕌",
        barClass: "bg-amber-500",
        bgClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
      },
      "اردو لازمی (Urdu Lazmi)": {
        icon: "ا",
        barClass: "bg-purple-500",
        bgClass: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
      },
    };

    const FALLBACK_ICONS = ["📚", "📐", "🔬", "📖", "✏️", "🎯"];
    let iconIdx = 0;

    return subjects.map((sub) => {
      const subChapters = chapters.filter((c) => c.subject_id === sub.id);
      const subChapterIds = new Set(subChapters.map((c) => c.id));
      const subMcqs = mcqs.filter(
        (m) => m.subject_id === sub.id || (m.chapter_id && subChapterIds.has(m.chapter_id)),
      );
      const subMcqIds = new Set(subMcqs.map((m) => m.id));
      const subAttempts = attempts.filter((a) => a.mcq_id && subMcqIds.has(a.mcq_id));
      const subCorrect = subAttempts.filter((a) => a.is_correct).length;
      const accuracy =
        subAttempts.length > 0 ? Math.round((subCorrect / subAttempts.length) * 100) : 0;

      const subTopics = topics.filter((t) => subChapterIds.has(t.chapter_id));
      const completedTopics = subTopics.filter((t) => t.completion === "completed").length;
      const coverage =
        subTopics.length > 0 ? Math.round((completedTopics / subTopics.length) * 100) : 0;

      const meta = SUBJECT_META[sub.name] ?? {
        icon: FALLBACK_ICONS[iconIdx++ % FALLBACK_ICONS.length],
        barClass: "bg-indigo-500",
        bgClass: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
      };

      return {
        id: sub.id,
        name: sub.name,
        accuracy,
        coverage,
        questionsAttempted: subAttempts.length,
        correctCount: subCorrect,
        icon: meta.icon,
        barClass: meta.barClass,
        bgClass: meta.bgClass,
      };
    });
  }, [subjects, chapters, mcqs, attempts, topics]);

  // ── Real Chapter Strengths (All real chapters from database) ─────────────
  const chapterStrengthsData = useMemo(() => {
    const rows: {
      id: string;
      name: string;
      subjectName: string;
      questions: number;
      accuracy: number;
      status: "Excellent" | "Strong" | "Needs focus" | "Untested";
      color: string;
    }[] = [];

    const SUBJECT_COLORS: Record<string, string> = {
      Mathematics: "#6366f1",
      Physics: "#10b981",
      Chemistry: "#f43f5e",
      Biology: "#14b8a6",
      "Computer Science": "#0ea5e9",
      English: "#3b82f6",
      Islamiat: "#f59e0b",
      "اردو لازمی (Urdu Lazmi)": "#a855f7",
    };

    chapters.forEach((ch) => {
      const chMcqs = mcqs.filter((m) => m.chapter_id === ch.id);
      const chMcqIds = new Set(chMcqs.map((m) => m.id));
      const chAttempts = attempts.filter((a) => a.mcq_id && chMcqIds.has(a.mcq_id));
      const sub = subjects.find((s) => s.id === ch.subject_id);

      if (chAttempts.length === 0) {
        rows.push({
          id: ch.id,
          name: ch.name,
          subjectName: sub?.name ?? "General",
          questions: 0,
          accuracy: 0,
          status: "Untested",
          color: SUBJECT_COLORS[sub?.name ?? ""] ?? "#6366f1",
        });
        return;
      }

      const acc = Math.round(
        (chAttempts.filter((a) => a.is_correct).length / chAttempts.length) * 100,
      );

      let status: "Excellent" | "Strong" | "Needs focus" = "Needs focus";
      if (acc >= 85 && chAttempts.length >= 5) {
        status = "Excellent";
      } else if (acc >= 70 && chAttempts.length >= 3) {
        status = "Strong";
      }

      rows.push({
        id: ch.id,
        name: ch.name,
        subjectName: sub?.name ?? "General",
        questions: chAttempts.length,
        accuracy: acc,
        status,
        color: SUBJECT_COLORS[sub?.name ?? ""] ?? "#6366f1",
      });
    });

    return rows.sort((a, b) => {
      if (a.questions > 0 && b.questions === 0) return -1;
      if (a.questions === 0 && b.questions > 0) return 1;
      return a.accuracy - b.accuracy;
    });
  }, [chapters, mcqs, attempts, subjects]);

  // ── Real Dynamic Next Best Action ────────────────────────────────────────
  const bestNextAction = useMemo(() => {
    const weakAttempted = chapterStrengthsData.find((c) => c.questions > 0 && c.accuracy < 70);
    if (weakAttempted) {
      return {
        title: `Review ${weakAttempted.name}`,
        highlight: `accuracy is ${weakAttempted.accuracy}%`,
        description: `You've answered ${weakAttempted.questions} questions in ${weakAttempted.name} (${weakAttempted.subjectName}). Improving this weak chapter will drive the biggest increase in your Exam Readiness Index.`,
        chapterId: weakAttempted.id,
        buttonText: "Practice weak chapter",
      };
    }

    const untested = chapterStrengthsData.find((c) => c.questions === 0);
    if (untested) {
      return {
        title: `Start ${untested.name}`,
        highlight: "not tested yet",
        description: `${untested.name} in ${untested.subjectName} has 0 recorded practice attempts. Solving diagnostic questions here will expand your syllabus coverage.`,
        chapterId: untested.id,
        buttonText: "Begin chapter drill",
      };
    }

    const firstSubject = subjects[0];
    return {
      title: firstSubject ? `Practice ${firstSubject.name}` : "Begin Diagnostic Practice",
      highlight: "establish your baseline",
      description:
        "Answer multiple choice questions across your syllabus chapters to establish your accuracy trend and unlock detailed chapter strengths.",
      chapterId: chapters[0]?.id,
      buttonText: "Start diagnostic test",
    };
  }, [chapterStrengthsData, subjects, chapters]);

  // ── Criteria Detail Builder for Inspector Modal ─────────────────────────
  const openCriteriaModal = (
    criteriaType:
      "readiness" | "accuracy" | "study_time" | "streak" | "syllabus" | "subjects" | "chapters",
  ) => {
    switch (criteriaType) {
      case "readiness":
        setActiveCriteriaModal({
          title: "Exam Readiness Index (ERI)",
          metricKey: "exam_readiness",
          functionName: "calculateExamReadinessIndex",
          formula:
            "ERI = (Syllabus Coverage × 0.40) + (Diagnostic Accuracy × 0.35) + (Memory Retention × 0.15) + (Habit Consistency × 0.10)",
          summary:
            "Composite academic score predicting exam readiness based on 4 verified pillars of student preparation.",
          criteria: [
            "Syllabus Coverage (40% weight): Percentage of curriculum topics marked completed in your syllabus.",
            "Diagnostic Accuracy (35% weight): Ratio of correct MCQ answers across all logged drills.",
            "Memory Retention (15% weight): Percentage of flashcard items mastered according to spaced repetition intervals.",
            "Habit Consistency (10% weight): Consecutive daily streak and frequency of study sessions.",
            "Grade Boundaries: 90%+ = A+ (Exam Ready), 80-89% = A, 70-79% = B, 60-69% = C, <60% = Early Stage.",
          ],
          inputs: {
            "Syllabus Coverage": `${Math.round(syllabusResult.coveragePct)}% (Weight: 40%)`,
            "Overall Accuracy": `${Math.round(accuracyResult.overallAccuracy)}% (Weight: 35%)`,
            "Spaced Retention": `${Math.round(retentionResult.retentionPct)}% (Weight: 15%)`,
            "Habit Consistency": `${Math.round(streakResult.consistencyScore)}% (Weight: 10%)`,
            "Calculated Readiness Score": `${examReadinessResult.score}% (Grade: ${examReadinessResult.letterGrade})`,
          },
          howItMoves:
            "Your Readiness score goes UP when you complete syllabus topics (+0.4 pts per %), answer questions correctly (+0.35 pts per %), and maintain your study streak (+0.1 pts per %). It drops or stagnates when accuracy drops on recent drills or when study streaks are broken.",
          recommendation:
            examReadinessResult.details.recommendation ||
            "Solve daily practice questions and review spaced flashcards to drive your readiness index above 85%.",
          status: examReadinessResult.details.status,
        });
        break;

      case "accuracy":
        setActiveCriteriaModal({
          title: "Overall MCQ Accuracy Rate",
          metricKey: "accuracy",
          functionName: "calculateAccuracyMetrics",
          formula: "Accuracy % = (Total Correct Attempts / Total Logged Attempts) × 100",
          summary:
            "Core metric of test performance measuring precision and factual correctness across multiple choice questions.",
          criteria: [
            "Includes every verified MCQ submitted by you in practice drills, mock tests, and topic reviews.",
            "Mastery Tier: ≥85% accuracy demonstrates strong conceptual command.",
            "Proficient Tier: 70%–84% accuracy indicates passing competency.",
            "Review Tier: <70% flags topics requiring immediate conceptual re-study.",
          ],
          inputs: {
            "Total Questions Attempted": filteredAttempts.length,
            "Correct Answers": accuracyResult.correctCount,
            "Incorrect Answers": accuracyResult.incorrectCount,
            "Accuracy in Current Window": `${accuracyResult.overallAccuracy}%`,
            "Prior Period Accuracy": `${priorAccuracyResult.overallAccuracy}%`,
            "Net Accuracy Delta": `${Math.round(accuracyResult.overallAccuracy - priorAccuracyResult.overallAccuracy)}%`,
          },
          howItMoves:
            "Correct answers immediately increase this percentage. Wrong answers decrease it. To push your accuracy up, review explanations after each question and avoid blind guessing.",
          recommendation:
            "Focus on weak chapters tagged 'Needs focus' to bring your overall accuracy above the 80% competitive threshold.",
          status: accuracyResult.details.status,
        });
        break;

      case "study_time":
        setActiveCriteriaModal({
          title: "Study Time & Active Pacing",
          metricKey: "study_time",
          functionName: "calculateStudyTime",
          formula:
            "Study Hours = Tracked Focus Sessions + (MCQ Count × Average Seconds Per Question / 3600)",
          summary:
            "Combines active stopwatch study sessions with estimated question solving time to measure dedicated prep hours.",
          criteria: [
            "Captures active focus timer sessions logged in the app.",
            "Incorporates actual pace time spent answering practice drills.",
            "Target for competitive exams: 1.5–3 hours daily of focused deliberate practice.",
          ],
          inputs: {
            "Total Tracked Sessions": sessions.length,
            "Questions Solved in Window": filteredAttempts.length,
            "Calculated Study Hours": `${studyTimeResult.totalHours ?? 0} hours`,
            "Prior Period Hours": `${priorStudyTimeResult.totalHours ?? 0} hours`,
            "Timeframe Filter":
              timeframe === "7d"
                ? "Past 7 Days"
                : timeframe === "30d"
                  ? "Past 30 Days"
                  : "All Time",
          },
          howItMoves:
            "Increases automatically with every practice question solved and every timer session logged. Drops relative to prior periods if daily study habits taper off.",
          recommendation:
            "Aim for consistent 45-minute focused blocks with 10-minute breaks to maximize knowledge encoding without cognitive fatigue.",
          status: studyTimeResult.details.status,
        });
        break;

      case "streak":
        setActiveCriteriaModal({
          title: "Daily Study Streak & Habit Consistency",
          metricKey: "streak",
          functionName: "calculateStreakAndConsistency",
          formula:
            "Streak = Count of consecutive calendar days with ≥1 completed drill or session. Consistency = (Active Days in Window / Total Days) × 100",
          summary:
            "Measures habit discipline and cognitive momentum required to prevent the Ebbinghaus forgetting curve.",
          criteria: [
            "A calendar day counts as active when you answer at least 1 practice question or complete a study session.",
            "Missing a calendar day resets the current streak to 0.",
            "Consistency factor feeds directly into 10% of your Exam Readiness Index.",
          ],
          inputs: {
            "Current Streak": `${streakResult.currentStreak} consecutive days`,
            "Longest Streak": `${streakResult.longestStreak} days`,
            "Consistency Score": `${streakResult.consistencyScore}%`,
            "Active Study Days": `${streakResult.activeDaysCount} days`,
          },
          howItMoves:
            "Gains +1 day each day you open the app and answer at least one question. Resets if you go an entire calendar day without activity.",
          recommendation:
            "Solve at least 5 quick questions every single day — even on busy days — to safeguard your streak and memory retention.",
          status: streakResult.details.status,
        });
        break;

      case "subjects":
        setActiveCriteriaModal({
          title: "Subject Performance Criteria",
          metricKey: "subject_performance",
          functionName: "calculateSubjectPerformance",
          formula: "Subject Accuracy = (Correct Answers in Subject / Questions in Subject) × 100",
          summary:
            "Evaluates individual subject strength across all syllabus-linked questions and topics.",
          criteria: [
            "Calculated separately for every subject in your syllabus (e.g. Physics, Mathematics, Chemistry, English).",
            "Color-coded progress bars reflect real accuracy from your practice attempts.",
            "≥85% = Mastered (Green), 70-84% = Strong (Blue), <70% = Needs Practice (Amber/Red).",
          ],
          inputs: {
            "Total Subjects": subjects.length,
            "Subjects with Attempts": subjectBarsData.filter((s) => s.questionsAttempted > 0)
              .length,
            "Highest Accuracy Subject":
              subjectBarsData.reduce(
                (prev, cur) => (cur.accuracy > prev.accuracy ? cur : prev),
                subjectBarsData[0],
              )?.name || "None",
            "Lowest Accuracy Subject":
              subjectBarsData
                .filter((s) => s.questionsAttempted > 0)
                .reduce(
                  (prev, cur) => (cur.accuracy < prev.accuracy ? cur : prev),
                  subjectBarsData[0],
                )?.name || "None",
          },
          howItMoves:
            "Answering questions correctly in a specific subject directly increases that subject's bar. Wrong answers lower it. Unattempted subjects remain at 0% until you start practicing.",
          recommendation:
            "Distribute your study time evenly across all subjects rather than focusing solely on subjects you already find easy.",
          status: "good",
        });
        break;

      case "chapters":
        setActiveCriteriaModal({
          title: "Chapter Strengths & Weakness Criteria",
          metricKey: "chapter_strengths",
          functionName: "diagnoseWeakTopics",
          formula:
            "Chapter Status: Excellent (≥85% accuracy, ≥5 attempts) | Strong (≥70% accuracy, ≥3 attempts) | Needs Focus (<70% accuracy) | Untested (0 attempts)",
          summary:
            "Granular diagnostics pinpointing exact chapters that need review vs chapters where you have demonstrated mastery.",
          criteria: [
            "Chapters are sorted dynamically with lowest-accuracy chapters first so you can immediately see high-yield review targets.",
            "Untested chapters indicate syllabus gaps that need diagnostic testing.",
            "Clicking 'Practice' next to any chapter launches a 10-question focused drill directly on that topic.",
          ],
          inputs: {
            "Total Curriculum Chapters": chapters.length,
            "Tested Chapters": chapterStrengthsData.filter((c) => c.questions > 0).length,
            "Chapters Needing Focus": chapterStrengthsData.filter((c) => c.status === "Needs focus")
              .length,
            "Mastered Chapters": chapterStrengthsData.filter((c) => c.status === "Excellent")
              .length,
          },
          howItMoves:
            "As you answer questions in a chapter, its status badge dynamically changes from 'Untested' to 'Needs focus', 'Strong', or 'Excellent'.",
          recommendation:
            "Focus first on chapters marked 'Needs focus' until their accuracy rises above 75%.",
          status: "good",
        });
        break;

      default:
        break;
    }
  };

  // Export JSON Report
  const handleExport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      timeframe,
      examReadinessIndex: {
        score: examReadinessResult.score,
        grade: examReadinessResult.letterGrade,
        status: examReadinessResult.status,
        components: {
          syllabusCoveragePct: syllabusResult.coveragePct,
          diagnosticAccuracyPct: accuracyResult.overallAccuracy,
          retentionPct: retentionResult.retentionPct,
          consistencyScore: streakResult.consistencyScore,
        },
      },
      kpiSummary: {
        questionsAttempted: filteredAttempts.length,
        overallAccuracy: accuracyResult.overallAccuracy,
        studyTimeHours: studyTimeResult.totalHours ?? 0,
        currentStreakDays: streakResult.currentStreak,
      },
      subjectPerformance: subjectBarsData.map((s) => ({
        subject: s.name,
        accuracy: s.accuracy,
        questionsAttempted: s.questionsAttempted,
      })),
      chapterStrengths: chapterStrengthsData.map((c) => ({
        chapter: c.name,
        subject: c.subjectName,
        questions: c.questions,
        accuracy: c.accuracy,
        status: c.status,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyspark-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-[#fbfbfd] dark:bg-surface text-slate-800 dark:text-slate-100 transition-colors">
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ─── TOP HEADER BAR ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold">
                Analytics & Criteria
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Timeframe pill selector */}
              <div className="flex items-center rounded-xl bg-white dark:bg-surface-2 border border-slate-200/80 dark:border-slate-700/60 p-1 shadow-xs">
                {(["7d", "30d", "all"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeframe(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      timeframe === t
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {t === "7d" ? "Last 7 days" : t === "30d" ? "Last 30 days" : "All time"}
                  </button>
                ))}
              </div>

              {/* Criteria Inspector Quick Launcher */}
              <button
                type="button"
                onClick={() => openCriteriaModal("readiness")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-xs"
                title="View mathematical criteria and formulas"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>Criteria & Formulas</span>
              </button>

              {/* Export button */}
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-surface-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface transition-colors shadow-xs"
              >
                <svg
                  className="h-3.5 w-3.5 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* ─── PAGE HEADLINE ─────────────────────────────────────────── */}
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Learning analytics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track your real performance metrics calculated dynamically from your questions,
              syllabus, and study habits.
            </p>
          </div>

          {/* ─── 4 KPI CARDS (Real dynamic values & real trends) ────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Questions Attempted */}
            <div
              onClick={() => openCriteriaModal("accuracy")}
              className="group cursor-pointer bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      Questions attempted
                    </p>
                    <Info className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {filteredAttempts.length.toLocaleString()}
                  </p>
                  <p
                    className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                      attemptsTrend.sign === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : attemptsTrend.sign === "down"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {attemptsTrend.sign === "up" && <TrendingUp className="h-3 w-3" />}
                    {attemptsTrend.sign === "down" && <TrendingDown className="h-3 w-3" />}
                    {attemptsTrend.sign === "neutral" && <Minus className="h-3 w-3" />}
                    <span>{attemptsTrend.text}</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {attemptsTrend.label}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Overall Accuracy */}
            <div
              onClick={() => openCriteriaModal("accuracy")}
              className="group cursor-pointer bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      Overall accuracy
                    </p>
                    <Info className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {Math.round(accuracyResult.overallAccuracy)}%
                  </p>
                  <p
                    className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                      accuracyTrend.sign === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : accuracyTrend.sign === "down"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {accuracyTrend.sign === "up" && <TrendingUp className="h-3 w-3" />}
                    {accuracyTrend.sign === "down" && <TrendingDown className="h-3 w-3" />}
                    {accuracyTrend.sign === "neutral" && <Minus className="h-3 w-3" />}
                    <span>{accuracyTrend.text}</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {accuracyTrend.label}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Study Time */}
            <div
              onClick={() => openCriteriaModal("study_time")}
              className="group cursor-pointer bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      Study time
                    </p>
                    <Info className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {studyTimeLabel}
                  </p>
                  <p
                    className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                      studyTimeTrend.sign === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : studyTimeTrend.sign === "down"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {studyTimeTrend.sign === "up" && <TrendingUp className="h-3 w-3" />}
                    {studyTimeTrend.sign === "down" && <TrendingDown className="h-3 w-3" />}
                    {studyTimeTrend.sign === "neutral" && <Minus className="h-3 w-3" />}
                    <span>{studyTimeTrend.text}</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {studyTimeTrend.label}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Current Streak */}
            <div
              onClick={() => openCriteriaModal("streak")}
              className="group cursor-pointer bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <Flame className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      Current streak
                    </p>
                    <Info className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {streakResult.currentStreak} {streakResult.currentStreak === 1 ? "day" : "days"}
                  </p>
                  <p
                    className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                      streakTrend.sign === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {streakTrend.sign === "up" ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    <span>{streakTrend.text}</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {streakTrend.label}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── MIDDLE ROW: Chart + Subject Performance ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Accuracy Over Time Area Chart */}
            <div className="lg:col-span-3 bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                    Accuracy over time
                  </h2>
                  <button
                    type="button"
                    onClick={() => openCriteriaModal("accuracy")}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Calculator className="h-3 w-3" />
                    Formula
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  Daily accuracy curve calculated from your practice attempts in this timeframe.
                </p>
              </div>

              <div className="h-56 w-full relative">
                {!hasChartActivity && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-surface-2/70 backdrop-blur-[1px] rounded-xl text-center p-4">
                    <BarChart2 className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      No drills logged in this timeframe
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5">
                      Answer practice questions to see your accuracy curve rise and fall with your
                      daily performance.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/practice" })}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-700 transition-colors"
                    >
                      Start Practice Drill
                    </button>
                  </div>
                )}

                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(val) => `${val}%`}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface p-3 shadow-lg text-xs">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {label}
                              </p>
                              <p className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                                Accuracy: {payload[0].value}%
                              </p>
                              <p className="text-slate-400 text-[11px]">
                                Questions solved: {data.questions}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#accuracyGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject Performance Bars */}
            <div className="lg:col-span-2 bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                    Subject performance
                  </h2>
                  <button
                    type="button"
                    onClick={() => openCriteriaModal("subjects")}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Calculator className="h-3 w-3" />
                    Criteria
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
                  Verified accuracy across your syllabus subjects.
                </p>
              </div>

              <div className="space-y-4 flex-1">
                {subjectBarsData.map((s) => (
                  <SubjectBar
                    key={s.id}
                    name={s.name}
                    icon={s.icon}
                    pct={s.accuracy}
                    questions={s.questionsAttempted}
                    barClass={s.barClass}
                    bgClass={s.bgClass}
                    onPractice={() =>
                      navigate({
                        to: "/practice",
                        search: { subject: s.id, count: 10 } as unknown as Record<string, unknown>,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ─── BOTTOM ROW: Chapter Strengths + Best Next Action ────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Chapter Strengths Table */}
            <div className="lg:col-span-3 bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                    Chapter strengths
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Detailed accuracy and readiness status for every curriculum chapter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCriteriaModal("chapters")}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Status Criteria
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-6 py-3">
                        Chapter
                      </th>
                      <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-3">
                        Questions
                      </th>
                      <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-3">
                        Accuracy
                      </th>
                      <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-6 py-3">
                        Status
                      </th>
                      <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 px-6 py-3">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {chapterStrengthsData.map((ch) => (
                      <tr
                        key={ch.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: ch.color }}
                            >
                              {ch.name[0]}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {ch.name}
                              </p>
                              <p className="text-[10px] text-slate-400">{ch.subjectName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {ch.questions}
                        </td>
                        <td className="px-3 py-3.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {ch.questions > 0 ? `${ch.accuracy}%` : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <StatusBadge status={ch.status} />
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate({
                                to: "/practice",
                                search: { chapter: ch.id, count: 10 } as unknown as Record<
                                  string,
                                  unknown
                                >,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                          >
                            <span>Drill</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Best Next Action Card */}
            <div className="lg:col-span-2">
              <div className="h-full rounded-2xl border border-indigo-200/60 dark:border-indigo-700/40 bg-gradient-to-br from-indigo-50 via-violet-50/40 to-purple-50/60 dark:from-indigo-950/60 dark:via-violet-950/30 dark:to-surface-2 p-6 shadow-sm relative overflow-hidden flex flex-col justify-between gap-6">
                <span className="absolute top-4 right-6 text-indigo-200 dark:text-indigo-800 text-xl select-none pointer-events-none">
                  ✦
                </span>
                <span className="absolute bottom-8 right-12 text-indigo-100 dark:text-indigo-900/60 text-sm select-none pointer-events-none">
                  ✦
                </span>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-white dark:bg-surface-2 border border-indigo-200/60 dark:border-indigo-700/40 flex items-center justify-center shadow-sm">
                      <Target className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      Your best next action
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold leading-snug text-slate-900 dark:text-white">
                      {bestNextAction.title} —
                    </h3>
                    <h3 className="text-lg font-bold leading-snug text-slate-900 dark:text-white">
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                        {bestNextAction.highlight}
                      </span>
                    </h3>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {bestNextAction.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/practice",
                      search: bestNextAction.chapterId
                        ? { chapter: bestNextAction.chapterId, count: 10 }
                        : { count: 10 },
                    } as unknown as Record<string, unknown>)
                  }
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-semibold py-3 shadow-md hover:shadow-lg transition-all duration-200 group"
                >
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/20">
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  {bestNextAction.buttonText}
                </button>
              </div>
            </div>
          </div>

          {/* ─── EXAM READINESS INDEX COMPOSITE SECTION ────────────────── */}
          <div className="bg-white dark:bg-surface-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                    Exam Readiness Index
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    composite score
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-9">
                  Weighted composite: Syllabus 40% + Accuracy 35% + Retention 15% + Habit 10%
                </p>
              </div>

              <div className="flex items-baseline gap-3 ml-9 sm:ml-0">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {examReadinessResult.score}%
                </span>
                <span className="rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 uppercase tracking-wider">
                  {examReadinessResult.letterGrade}
                </span>
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {examReadinessResult.status}
                </span>
              </div>
            </div>

            {/* Segmented component bars */}
            <div className="space-y-3">
              {[
                {
                  label: "Syllabus Coverage",
                  value: syllabusResult.coveragePct,
                  weight: "40%",
                  color: "bg-indigo-500",
                },
                {
                  label: "Diagnostic Accuracy",
                  value: accuracyResult.overallAccuracy,
                  weight: "35%",
                  color: "bg-emerald-500",
                },
                {
                  label: "Memory Retention",
                  value: retentionResult.retentionPct,
                  weight: "15%",
                  color: "bg-amber-500",
                },
                {
                  label: "Habit Consistency",
                  value: streakResult.consistencyScore,
                  weight: "10%",
                  color: "bg-violet-500",
                },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {item.label}{" "}
                      <span className="text-slate-400 font-normal">({item.weight})</span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {Math.round(item.value)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-700`}
                      style={{ width: `${Math.min(100, Math.round(item.value))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Criteria button */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => openCriteriaModal("readiness")}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <Calculator className="h-3.5 w-3.5" />
                View calculation criteria & formulas
              </button>
              <span className="text-[11px] text-slate-400">
                Updates dynamically with every question answered
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DYNAMIC CRITERIA & FORMULA INSPECTOR MODAL ─────────────── */}
      {activeCriteriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setActiveCriteriaModal(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-2 shadow-2xl overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Calculator className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeCriteriaModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Engine function: {activeCriteriaModal.functionName}()
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCriteriaModal(null)}
                className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeCriteriaModal.summary}
              </p>

              {/* Formula Block */}
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1.5 uppercase tracking-wider">
                  Mathematical Formula
                </p>
                <code className="text-xs font-mono text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-wrap block">
                  {activeCriteriaModal.formula}
                </code>
              </div>

              {/* How it goes Up or Down */}
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>How your performance changes this score (Up / Down)</span>
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  {activeCriteriaModal.howItMoves}
                </p>
              </div>

              {/* Live Inputs Table */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Current User Inputs (from your actual data)
                </p>
                <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                  {Object.entries(activeCriteriaModal.inputs).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between p-2.5 text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-400">{key}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grading Criteria Bullet Points */}
              {activeCriteriaModal.criteria && activeCriteriaModal.criteria.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Official Criteria & Thresholds
                  </p>
                  <div className="space-y-1.5">
                    {activeCriteriaModal.criteria.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable recommendation */}
              {activeCriteriaModal.recommendation && (
                <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300 mb-1 uppercase tracking-wider">
                    Recommended Next Step
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    {activeCriteriaModal.recommendation}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 dark:border-slate-700 p-4 flex items-center justify-between bg-slate-50/50 dark:bg-surface-2">
              <span className="text-xs text-slate-400">100% transparent and deterministic</span>
              <button
                type="button"
                onClick={() => setActiveCriteriaModal(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Close Criteria
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SubjectBar({
  name,
  icon,
  pct,
  questions,
  barClass,
  bgClass,
  onPractice,
}: {
  name: string;
  icon: string;
  pct: number;
  questions: number;
  barClass: string;
  bgClass: string;
  onPractice?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${bgClass}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
            {name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {questions > 0 ? `${questions} Qs` : "Untested"}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 shrink-0">
              {pct}%
            </span>
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full ${barClass} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {onPractice && (
        <button
          type="button"
          onClick={onPractice}
          className="text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded transition-colors"
          title={`Practice ${name}`}
        >
          Drill
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "Excellent" | "Strong" | "Needs focus" | "Untested" }) {
  const styles = {
    Excellent:
      "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    Strong:
      "bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700/40",
    "Needs focus":
      "bg-amber-50 text-amber-800 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
    Untested:
      "bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/40",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}
