import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play,
  Zap,
  Target,
  AlertCircle,
  Sliders,
  Clock,
  Pause,
  Bookmark,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Select, Field, Empty, Tag, Stat } from "@/components/app/kit";
import { Ring } from "@/components/app/Ring";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { localStore } from "@/lib/local-store";
import {
  subjectsQuery,
  chaptersQuery,
  topicsQuery,
  mcqsQuery,
  attemptsQuery,
  type Mcq,
} from "@/lib/queries";

export const Route = createFileRoute("/practice")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    topicId?: string;
    chapterId?: string;
    subjectId?: string;
  } => ({
    topicId: search.topicId ? String(search.topicId) : undefined,
    chapterId: search.chapterId ? String(search.chapterId) : undefined,
    subjectId: search.subjectId ? String(search.subjectId) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Practice & Test — Study Spark" },
      {
        name: "description",
        content:
          "Run untimed practice with instant explanations, timed mock tests, weak-topic drills, and missed-only reviews.",
      },
      { property: "og:title", content: "Practice & Test — Study Spark" },
      {
        property: "og:description",
        content: "Master multiple choice questions with adaptive modes and instant explanations.",
      },
    ],
  }),
  component: Practice,
});

type DrillSetupMode = "quick" | "topic" | "weak" | "custom";
type FeedbackMode = "practice" | "test";

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = a;
  }
  return arr;
}

function Practice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: topics = [] } = useQuery({ ...topicsQuery(), enabled: !!user });
  const { data: bank = [] } = useQuery({ ...mcqsQuery({ status: "approved" }), enabled: !!user });
  const { data: previousAttempts = [] } = useQuery({ ...attemptsQuery(200), enabled: !!user });

  // Setup state
  const [drillPreset, setDrillPreset] = useState<DrillSetupMode>("quick");
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("practice");
  const [selectedSubjectId, setSelectedSubjectId] = useState(search.subjectId || "");
  const [selectedChapterId, setSelectedChapterId] = useState(search.chapterId || "");
  const [selectedTopicId, setSelectedTopicId] = useState(search.topicId || "");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"all" | "easy" | "medium" | "hard">(
    "all",
  );
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);

  // Sync search parameters from URL
  useEffect(() => {
    if (search.topicId) {
      setSelectedTopicId(search.topicId);
      setDrillPreset("topic");
      const t = topics.find((item) => item.id === search.topicId);
      if (t) {
        setSelectedChapterId(t.chapter_id);
      }
    } else if (search.chapterId) {
      setSelectedChapterId(search.chapterId);
      setDrillPreset("topic");
    } else if (search.subjectId) {
      setSelectedSubjectId(search.subjectId);
    }
  }, [search.topicId, search.chapterId, search.subjectId, topics]);

  // In-drill execution state
  const [queue, setQueue] = useState<Mcq[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const startTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Derive Missed / Weak Question IDs
  const missedQuestionIds = useMemo(() => {
    const incorrect = new Set<string>();
    previousAttempts.forEach((att) => {
      const isWrong = att.is_correct === false || att.correct === false;
      if (isWrong && att.mcq_id) {
        incorrect.add(att.mcq_id);
      }
    });
    return incorrect;
  }, [previousAttempts]);

  // Derived filtered pool based on setup preset
  const filteredPool = useMemo(() => {
    return bank.filter((m) => {
      if (drillPreset === "weak") {
        return missedQuestionIds.has(m.id);
      }
      if (selectedSubjectId && m.subject_id !== selectedSubjectId) return false;
      if (selectedChapterId && m.chapter_id !== selectedChapterId) return false;
      if (selectedTopicId) {
        const targetTopic = topics.find((t) => t.id === selectedTopicId);
        const matchesTopicId = m.topic_id === selectedTopicId;
        const matchesTag =
          targetTopic &&
          (m.tags || []).some(
            (tag) =>
              tag.toLowerCase() === targetTopic.name.toLowerCase() ||
              targetTopic.name.toLowerCase().includes(tag.toLowerCase()),
          );
        if (!matchesTopicId && !matchesTag) return false;
      }
      if (selectedDifficulty !== "all" && m.difficulty !== selectedDifficulty) return false;
      return true;
    });
  }, [
    bank,
    drillPreset,
    missedQuestionIds,
    selectedSubjectId,
    selectedChapterId,
    selectedTopicId,
    selectedDifficulty,
    topics,
  ]);

  // Completion & SM-2 Persistence
  const handleFinishDrill = async () => {
    setIsFinished(true);
    localStore.clearIncompleteSession();

    if (!queue || !user) return;

    // Calculate score
    let correctCount = 0;
    const records = queue.map((q) => {
      const picked = answers[q.id];
      const correct = picked === q.correct_index;
      if (correct) correctCount++;
      return {
        id: crypto.randomUUID(),
        user_id: user.id,
        mcq_id: q.id,
        session_id: sessionIdRef.current,
        chosen_index: picked !== undefined ? picked : -1,
        is_correct: correct,
        selected_index: picked !== undefined ? picked : -1,
        mode: feedbackMode,
        created_at: new Date().toISOString(),
      };
    });

    // Record session and attempts in parallel
    try {
      const { error: sessionError } = await supabase.from("study_sessions").insert({
        id: sessionIdRef.current,
        user_id: user.id,
        mode: feedbackMode,
        subject_id: selectedSubjectId || null,
        chapter_id: selectedChapterId || null,
        total: queue.length,
        correct: correctCount,
        duration_sec: secondsElapsed,
        created_at: new Date().toISOString(),
      });
      if (sessionError) throw new Error(sessionError.message);

      for (const rec of records) {
        const { error: attemptError } = await supabase.from("attempts").insert(rec);
        if (attemptError) throw new Error(attemptError.message);
      }

      // Calculate accuracy and update Spaced Repetition SM-2 schedule for topic
      const accuracyPercent =
        queue.length > 0 ? Math.round((correctCount / queue.length) * 100) : 0;
      if (selectedTopicId) {
        const updatedTopic = localStore.updateTopicSM2(selectedTopicId, accuracyPercent);
        if (updatedTopic) {
          toast.success(
            `🎯 SM-2 Schedule Updated: Next review due in ${updatedTopic.interval_days} day(s)!`,
          );
        }
      } else {
        // Collect all topic IDs referenced in questions queue
        const topicIds = new Set<string>();
        queue.forEach((q) => {
          if (q.topic_id) topicIds.add(q.topic_id);
        });
        topicIds.forEach((tId) => localStore.updateTopicSM2(tId, accuracyPercent));
      }

      qc.invalidateQueries({ queryKey: ["attempts"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      toast.success("Session saved to your study analytics!");
    } catch (err) {
      console.error("Error saving drill attempts:", err);
    }
  };

  // Timer Tick
  const handleFinishDrillRef = useRef(handleFinishDrill);
  handleFinishDrillRef.current = handleFinishDrill;

  useEffect(() => {
    if (!queue || isFinished || isPaused) return;

    const timer = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
      if (feedbackMode === "test" && secondsLeft > 0) {
        setSecondsLeft((s) => {
          if (s <= 1) {
            handleFinishDrillRef.current();
            return 0;
          }
          return s - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [queue, isFinished, isPaused, feedbackMode, secondsLeft]);

  // Check for existing incomplete session to restore on load
  useEffect(() => {
    const saved = localStore.getIncompleteSession();
    if (saved && saved.savedState && !queue) {
      // Available for restore if needed
    }
  }, [queue]);

  const handleStartDrill = (customSet?: Mcq[]) => {
    const targetPool = customSet || filteredPool;
    if (targetPool.length === 0) {
      toast.error(
        "No questions match your filter criteria. Try adding questions or selecting another topic.",
      );
      return;
    }

    const countToTake = drillPreset === "quick" ? 10 : Math.min(questionCount, targetPool.length);
    const selected = shuffle(targetPool).slice(0, countToTake);

    sessionIdRef.current = crypto.randomUUID();
    startTimeRef.current = Date.now();
    setQueue(selected);
    setCurrentIndex(0);
    setAnswers({});
    setFlaggedIds({});
    setRevealed(false);
    setIsPaused(false);
    setIsFinished(false);
    setSecondsElapsed(0);
    setSecondsLeft(timeLimitMinutes * 60);

    // Save to incomplete session cache
    localStore.saveIncompleteSession({
      id: sessionIdRef.current,
      type: "practice",
      title: "Active Practice Drill",
      subtitle: `${selected.length} questions in queue`,
      currentIdx: 0,
      total: selected.length,
      subjectId: selectedSubjectId || undefined,
      chapterId: selectedChapterId || undefined,
      savedState: {
        queue: selected,
        answers: {},
        index: 0,
        startedAt: Date.now(),
        mode: feedbackMode,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const currentQuestion = queue ? queue[currentIndex] : null;

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion || isFinished || (feedbackMode === "practice" && revealed)) return;

    const updatedAnswers = { ...answers, [currentQuestion.id]: optionIndex };
    setAnswers(updatedAnswers);

    if (feedbackMode === "practice") {
      setRevealed(true);
    }

    // Update incomplete session state
    localStore.saveIncompleteSession({
      id: sessionIdRef.current,
      type: "practice",
      title: "Active Practice Drill",
      subtitle: `${Object.keys(updatedAnswers).length} of ${queue?.length || 0} answered`,
      currentIdx: currentIndex,
      total: queue?.length || 0,
      subjectId: selectedSubjectId || undefined,
      chapterId: selectedChapterId || undefined,
      savedState: {
        queue: queue || [],
        answers: updatedAnswers,
        index: currentIndex,
        startedAt: startTimeRef.current,
        mode: feedbackMode,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleNext = () => {
    if (!queue) return;
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
    } else {
      handleFinishDrill();
    }
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    setFlaggedIds((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
    toast.success(flaggedIds[currentQuestion.id] ? "Flag removed" : "Question flagged for review");
  };

  // Retry missed questions only
  const handleRetryMissedOnly = () => {
    if (!queue) return;
    const missed = queue.filter((q) => answers[q.id] !== q.correct_index);
    if (missed.length === 0) {
      toast.success("Great job! You got 100% correct in this session.");
      return;
    }
    handleStartDrill(missed);
  };

  // Metrics for finished state
  const correctTotal = useMemo(() => {
    if (!queue) return 0;
    return queue.filter((q) => answers[q.id] === q.correct_index).length;
  }, [queue, answers]);

  const scorePercentage =
    queue && queue.length > 0 ? Math.round((correctTotal / queue.length) * 100) : 0;

  return (
    <AppShell
      title="Practice & Assessment"
      subtitle="Answer active MCQ bank questions with adaptive modes, explanations and analytics"
    >
      {/* 1. SETUP VIEW */}
      {!queue && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Preset Mode Selector Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setDrillPreset("quick")}
              className={`rounded-2xl border p-4 text-left transition-all ${
                drillPreset === "quick"
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-border-2 hover:bg-surface-2/40"
              }`}
            >
              <div className="flex items-center gap-2 text-accent">
                <Zap className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Quick Drill</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground">10 High-Yield MCQs</h3>
              <p className="mt-1 text-xs text-muted">Rapid randomized drill across all subjects</p>
            </button>

            <button
              type="button"
              onClick={() => setDrillPreset("topic")}
              className={`rounded-2xl border p-4 text-left transition-all ${
                drillPreset === "topic"
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-border-2 hover:bg-surface-2/40"
              }`}
            >
              <div className="flex items-center gap-2 text-blue-400">
                <Target className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Topic Focus</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Subject & Chapter</h3>
              <p className="mt-1 text-xs text-muted">Deep dive into a single syllabus module</p>
            </button>

            <button
              type="button"
              onClick={() => setDrillPreset("weak")}
              className={`rounded-2xl border p-4 text-left transition-all ${
                drillPreset === "weak"
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-border-2 hover:bg-surface-2/40"
              }`}
            >
              <div className="flex items-center gap-2 text-rose">
                <AlertCircle className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Weak Areas</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                Missed Questions ({missedQuestionIds.size})
              </h3>
              <p className="mt-1 text-xs text-muted">Drill items you got wrong in past tests</p>
            </button>

            <button
              type="button"
              onClick={() => setDrillPreset("custom")}
              className={`rounded-2xl border p-4 text-left transition-all ${
                drillPreset === "custom"
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-border-2 hover:bg-surface-2/40"
              }`}
            >
              <div className="flex items-center gap-2 text-purple-400">
                <Sliders className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Custom Setup</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Advanced Filters</h3>
              <p className="mt-1 text-xs text-muted">Select count, timer, and difficulty tier</p>
            </button>
          </div>

          {/* Configuration Form Panel */}
          <Panel className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Session Parameters</h2>
                <p className="text-xs text-muted">
                  Matching question pool:{" "}
                  <span className="font-semibold text-accent font-mono">{filteredPool.length}</span>{" "}
                  questions available
                </p>
              </div>

              {/* Feedback Mode Selector */}
              <div className="flex items-center rounded-xl border border-border bg-surface-2 p-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setFeedbackMode("practice")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    feedbackMode === "practice"
                      ? "bg-accent text-accent-contrast shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Practice (Instant Feedback)
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackMode("test")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    feedbackMode === "test"
                      ? "bg-accent text-accent-contrast shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Timed Test (Score at End)
                </button>
              </div>
            </div>

            {/* Filter Inputs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(drillPreset === "topic" || drillPreset === "custom") && (
                <>
                  <Field label="Subject Filter:">
                    <Select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        setSelectedSubjectId(e.target.value);
                        setSelectedChapterId("");
                      }}
                      className="text-xs"
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Chapter Filter:">
                    <Select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="text-xs"
                    >
                      <option value="">All Chapters</option>
                      {chapters
                        .filter((c) => !selectedSubjectId || c.subject_id === selectedSubjectId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </>
              )}

              {drillPreset === "custom" && (
                <>
                  <Field label="Difficulty:">
                    <Select
                      value={selectedDifficulty}
                      onChange={(e) =>
                        setSelectedDifficulty(e.target.value as typeof selectedDifficulty)
                      }
                      className="text-xs"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </Select>
                  </Field>

                  <Field label="Question Count:">
                    <Select
                      value={String(questionCount)}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="text-xs"
                    >
                      {[5, 10, 15, 20, 30, 50].map((n) => (
                        <option key={n} value={n}>
                          {n} Questions
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {feedbackMode === "test" && (
                    <Field label="Time Limit:">
                      <Select
                        value={String(timeLimitMinutes)}
                        onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                        className="text-xs"
                      >
                        {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                          <option key={m} value={m}>
                            {m} Minutes
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Btn
                onClick={() => handleStartDrill()}
                disabled={filteredPool.length === 0}
                className="gap-2 px-6"
              >
                <Play className="size-4" /> Start{" "}
                {feedbackMode === "practice" ? "Practice Drill" : "Timed Test"}
              </Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* 2. ACTIVE DRILL IN PROGRESS */}
      {queue && !isFinished && currentQuestion && (
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Progress Bar & Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent">
                Question {currentIndex + 1} of {queue.length}
              </span>
              <Tag tone="accent">{currentQuestion.difficulty}</Tag>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              {feedbackMode === "test" ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-foreground">
                  <Clock className="size-3.5 text-accent" />
                  <span>
                    {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted">
                  <Clock className="size-3 text-faint" />
                  <span>{secondsElapsed}s elapsed</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleFlag}
                className={`p-1.5 rounded-lg border transition ${
                  flaggedIds[currentQuestion.id]
                    ? "border-amber bg-amber/15 text-amber"
                    : "border-border text-muted hover:text-foreground"
                }`}
                title="Flag question for review"
              >
                <Bookmark className="size-3.5" />
              </button>

              <Btn
                variant="outline"
                size="sm"
                onClick={() => setIsPaused((p) => !p)}
                className="text-xs"
              >
                {isPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </Btn>
            </div>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          <Panel className="p-6 space-y-6">
            <p className="text-base font-medium text-foreground leading-relaxed">
              {currentQuestion.question}
            </p>

            {/* Multiple Choice Options */}
            <div className="space-y-2.5">
              {currentQuestion.options.map((optionText, optIdx) => {
                const isSelected = answers[currentQuestion.id] === optIdx;
                const isCorrect = optIdx === currentQuestion.correct_index;
                const showFeedback = feedbackMode === "practice" && revealed;

                let stateClasses =
                  "border-border bg-surface hover:border-border-2 hover:bg-surface-2/50";
                if (showFeedback) {
                  if (isCorrect) {
                    stateClasses = "border-accent bg-accent/10 text-accent font-semibold";
                  } else if (isSelected && !isCorrect) {
                    stateClasses = "border-rose bg-rose/10 text-rose font-semibold";
                  }
                } else if (isSelected) {
                  stateClasses = "border-accent bg-accent/10 font-semibold ring-1 ring-accent";
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(optIdx)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-xs transition-all ${stateClasses}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-[11px] font-bold text-faint">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1">{optionText}</span>
                    {showFeedback && isCorrect && <CheckCircle2 className="size-4 text-accent" />}
                    {showFeedback && isSelected && !isCorrect && (
                      <XCircle className="size-4 text-rose" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant Explanation in Practice Mode */}
            {feedbackMode === "practice" && revealed && currentQuestion.explanation && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs space-y-1">
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Concept Explanation:
                </span>
                <p className="text-muted leading-relaxed">{currentQuestion.explanation}</p>
              </div>
            )}

            {/* Navigation Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Btn variant="ghost" size="sm" onClick={handleFinishDrill}>
                End Drill Early
              </Btn>

              <Btn
                onClick={handleNext}
                disabled={feedbackMode === "practice" && !revealed}
                className="gap-2"
              >
                <span>
                  {currentIndex + 1 >= queue.length ? "Submit & View Results" : "Next Question"}
                </span>
                <ArrowRight className="size-3.5" />
              </Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* 3. POST-DRILL ANALYTICS & SUMMARY */}
      {queue && isFinished && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Panel className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Ring value={scorePercentage} size={110} />
              <div className="space-y-1 text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-foreground">Session Complete!</h2>
                <p className="text-xs text-muted">
                  Scored <strong className="text-accent">{correctTotal}</strong> out of{" "}
                  <strong>{queue.length}</strong> questions ({scorePercentage}% accuracy) in{" "}
                  {Math.round(secondsElapsed)} seconds.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <Btn onClick={() => setQueue(null)}>New Practice Drill</Btn>
                  <Btn variant="outline" onClick={handleRetryMissedOnly} className="gap-1.5">
                    <RotateCcw className="size-3.5" /> Retry Missed Only
                  </Btn>
                  <Link to="/">
                    <Btn variant="ghost">Return to Dashboard</Btn>
                  </Link>
                </div>
              </div>
            </div>
          </Panel>

          {/* Question Breakdown List */}
          <Panel className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground pb-2 border-b border-border">
              Detailed Question Review ({queue.length})
            </h3>
            <div className="space-y-3">
              {queue.map((q, idx) => {
                const picked = answers[q.id];
                const isCorrect = picked === q.correct_index;
                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-4 space-y-2 text-xs transition-colors ${
                      isCorrect ? "border-border bg-surface/50" : "border-rose/30 bg-rose/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-faint">Q{idx + 1}.</span>
                        <p className="font-medium text-foreground">{q.question}</p>
                      </div>
                      <Tag tone={isCorrect ? "accent" : "rose"}>
                        {isCorrect ? "Correct" : "Missed"}
                      </Tag>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted pl-5 font-mono">
                      <div>
                        Correct Answer:{" "}
                        <span className="text-accent font-semibold">
                          {q.options[q.correct_index]}
                        </span>
                      </div>
                      {!isCorrect && picked !== undefined && (
                        <div>
                          Your Choice:{" "}
                          <span className="text-rose line-through">
                            {q.options[picked] || "Unanswered"}
                          </span>
                        </div>
                      )}
                    </div>

                    {q.explanation && (
                      <p className="mt-2 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted leading-relaxed">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
