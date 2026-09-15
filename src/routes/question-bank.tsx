import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Copy,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  QrCode,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { localStore } from "@/lib/local-store";
import {
  subjectsQuery,
  chaptersQuery,
  sourcesQuery,
  mcqsQuery,
  SUBJECT_COLORS,
  colorClass,
  type Mcq,
  type Subject,
  type Chapter,
  type Source,
} from "@/lib/queries";

export const Route = createFileRoute("/question-bank")({
  head: () => ({
    meta: [
      { title: "Question Bank — Study Spark" },
      {
        name: "description",
        content:
          "Create, organise and review questions across every subject in the web application.",
      },
      { property: "og:title", content: "Question Bank — Study Spark" },
      {
        property: "og:description",
        content:
          "Create, organise and review questions across every subject in the web application.",
      },
    ],
  }),
  component: QuestionBankPage,
});

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function QuestionBankPage() {
  const qc = useQueryClient();

  // Load all foundational data
  const { data: subjects = [] } = useQuery(subjectsQuery());
  const { data: chapters = [] } = useQuery(chaptersQuery());
  const { data: sources = [] } = useQuery(sourcesQuery());
  const { data: mcqs = [] } = useQuery(mcqsQuery());

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("all");

  // Expanded explanations
  const [expandedExplanationIds, setExpandedExplanationIds] = useState<Set<string>>(new Set());

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingMcqId, setEditingMcqId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editor Form Fields
  const [formSubjectId, setFormSubjectId] = useState<string>("");
  const [formChapterId, setFormChapterId] = useState<string>("");
  const [formSourceId, setFormSourceId] = useState<string>("");
  const [formQuestionType, setFormQuestionType] = useState<string>("multiple_choice");
  const [formPrompt, setFormPrompt] = useState<string>("");
  const [formOptions, setFormOptions] = useState<[string, string, string, string]>([
    "",
    "",
    "",
    "",
  ]);
  const [formCorrectIndex, setFormCorrectIndex] = useState<number>(0);
  const [formExplanation, setFormExplanation] = useState<string>("");
  const [formDifficulty, setFormDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Mcq | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subject -> Chapter cascading in filter
  useEffect(() => {
    if (selectedSubjectId !== "all") {
      const subjectChapters = chapters.filter((c) => c.subject_id === selectedSubjectId);
      if (selectedChapterId !== "all" && !subjectChapters.some((c) => c.id === selectedChapterId)) {
        setSelectedChapterId("all");
      }
    }
  }, [selectedSubjectId, selectedChapterId, chapters]);

  // Chapter -> Source cascading in filter
  useEffect(() => {
    if (selectedChapterId !== "all") {
      const chapterSources = sources.filter((s) => s.chapter_id === selectedChapterId);
      if (selectedSourceId !== "all" && !chapterSources.some((s) => s.id === selectedSourceId)) {
        setSelectedSourceId("all");
      }
    } else if (selectedSubjectId !== "all") {
      const subjectChapIds = new Set(
        chapters.filter((c) => c.subject_id === selectedSubjectId).map((c) => c.id),
      );
      const subjectSources = sources.filter((s) => subjectChapIds.has(s.chapter_id));
      if (selectedSourceId !== "all" && !subjectSources.some((s) => s.id === selectedSourceId)) {
        setSelectedSourceId("all");
      }
    }
  }, [selectedChapterId, selectedSubjectId, selectedSourceId, sources, chapters]);

  // Form cascading: Subject changes
  const handleFormSubjectChange = (newSubId: string) => {
    setFormSubjectId(newSubId);
    const subChaps = chapters.filter((c) => c.subject_id === newSubId);
    const firstChap = subChaps[0];
    if (firstChap) {
      setFormChapterId(firstChap.id);
      const chapSources = sources.filter((s) => s.chapter_id === firstChap.id);
      const firstSource = chapSources[0];
      setFormSourceId(firstSource ? firstSource.id : "");
    } else {
      setFormChapterId("");
      setFormSourceId("");
    }
  };

  // Form cascading: Chapter changes
  const handleFormChapterChange = (newChapId: string) => {
    setFormChapterId(newChapId);
    const chapSources = sources.filter((s) => s.chapter_id === newChapId);
    const firstSource = chapSources[0];
    if (firstSource) {
      setFormSourceId(firstSource.id);
    } else {
      setFormSourceId("");
    }
  };

  // Filter available chapters for filter pills
  const availableFilterChapters = useMemo(() => {
    if (selectedSubjectId === "all") return chapters;
    return chapters.filter((c) => c.subject_id === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  // Filter available sources for filter pills
  const availableFilterSources = useMemo(() => {
    if (selectedChapterId !== "all") {
      return sources.filter((s) => s.chapter_id === selectedChapterId);
    }
    if (selectedSubjectId !== "all") {
      const subjectChapIds = new Set(
        chapters.filter((c) => c.subject_id === selectedSubjectId).map((c) => c.id),
      );
      return sources.filter((s) => subjectChapIds.has(s.chapter_id));
    }
    return sources;
  }, [sources, selectedChapterId, selectedSubjectId, chapters]);

  // Filter form chapters
  const availableFormChapters = useMemo(() => {
    if (!formSubjectId) return [];
    return chapters.filter((c) => c.subject_id === formSubjectId);
  }, [chapters, formSubjectId]);

  // Filter form sources
  const availableFormSources = useMemo(() => {
    if (!formChapterId) return [];
    return sources.filter((s) => s.chapter_id === formChapterId);
  }, [sources, formChapterId]);

  // Fast entity lookup maps
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const chapterMap = useMemo(() => {
    const map = new Map<string, Chapter>();
    chapters.forEach((c) => map.set(c.id, c));
    return map;
  }, [chapters]);

  const sourceMap = useMemo(() => {
    const map = new Map<string, Source>();
    sources.forEach((s) => map.set(s.id, s));
    return map;
  }, [sources]);

  // Filter MCQs
  const filteredMcqs = useMemo(() => {
    let result = [...mcqs];

    // Deduplicate MCQs by ID
    const seenIds = new Set<string>();
    result = result.filter((m) => {
      if (!m || !m.id || seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((m) => {
        const inPrompt = m.question?.toLowerCase().includes(q);
        const inOptions = m.options?.some((opt) => opt.toLowerCase().includes(q));
        const inExplanation = m.explanation?.toLowerCase().includes(q);
        const inTags = m.tags?.some((t) => t.toLowerCase().includes(q));
        return inPrompt || inOptions || inExplanation || inTags;
      });
    }

    // Subject filter
    if (selectedSubjectId !== "all") {
      result = result.filter((m) => m.subject_id === selectedSubjectId);
    }

    // Chapter filter
    if (selectedChapterId !== "all") {
      result = result.filter((m) => m.chapter_id === selectedChapterId);
    }

    // Source filter
    if (selectedSourceId !== "all") {
      result = result.filter((m) => m.source_id === selectedSourceId);
    }

    return result;
  }, [mcqs, searchQuery, selectedSubjectId, selectedChapterId, selectedSourceId]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedSubjectId !== "all" ||
    selectedChapterId !== "all" ||
    selectedSourceId !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedSubjectId("all");
    setSelectedChapterId("all");
    setSelectedSourceId("all");
  };

  // Toggle explanation accordion
  const toggleExplanation = (id: string) => {
    setExpandedExplanationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditorMode("create");
    setEditingMcqId(null);

    const initialSubId = selectedSubjectId !== "all" ? selectedSubjectId : subjects[0]?.id || "";
    setFormSubjectId(initialSubId);

    const subChaps = chapters.filter((c) => c.subject_id === initialSubId);
    const initialChapId = selectedChapterId !== "all" ? selectedChapterId : subChaps[0]?.id || "";
    setFormChapterId(initialChapId);

    const chapSources = sources.filter((s) => s.chapter_id === initialChapId);
    const initialSrcId = selectedSourceId !== "all" ? selectedSourceId : chapSources[0]?.id || "";
    setFormSourceId(initialSrcId);

    setFormQuestionType("multiple_choice");
    setFormPrompt("");
    setFormOptions(["", "", "", ""]);
    setFormCorrectIndex(0);
    setFormExplanation("");
    setFormDifficulty("medium");

    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (mcq: Mcq) => {
    setEditorMode("edit");
    setEditingMcqId(mcq.id);

    setFormSubjectId(mcq.subject_id || subjects[0]?.id || "");
    setFormChapterId(mcq.chapter_id || "");
    setFormSourceId(mcq.source_id || "");
    setFormQuestionType("multiple_choice");
    setFormPrompt(mcq.question || "");

    const opts: [string, string, string, string] = [
      mcq.options?.[0] || "",
      mcq.options?.[1] || "",
      mcq.options?.[2] || "",
      mcq.options?.[3] || "",
    ];
    setFormOptions(opts);
    setFormCorrectIndex(
      typeof mcq.correct_index === "number" && mcq.correct_index >= 0 ? mcq.correct_index : 0,
    );
    setFormExplanation(mcq.explanation || "");
    setFormDifficulty((mcq.difficulty as "easy" | "medium" | "hard") || "medium");

    setIsEditorOpen(true);
  };

  // Save or Create Question
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formPrompt.trim()) {
      toast.error("Please enter a question prompt.");
      return;
    }

    if (!formSubjectId) {
      toast.error("Please select a subject.");
      return;
    }

    const filledOptions = formOptions.map((o) => o.trim());
    if (filledOptions.some((o) => !o)) {
      toast.error("Please provide text for all 4 answer options.");
      return;
    }

    setIsSaving(true);
    const questionPayload = {
      subject_id: formSubjectId,
      chapter_id: formChapterId || null,
      source_id: formSourceId || null,
      question: formPrompt.trim(),
      options: filledOptions,
      correct_index: formCorrectIndex,
      explanation: formExplanation.trim() || null,
      difficulty: formDifficulty,
      status: "approved",
      origin: "user",
      tags: [],
    };

    try {
      if (editorMode === "create") {
        localStore.addMcq(questionPayload);
        await qc.invalidateQueries({ queryKey: ["mcqs"] });

        toast.success("Question created and added to the Question Bank!");
        setIsEditorOpen(false);
      } else if (editorMode === "edit" && editingMcqId) {
        localStore.updateMcq(editingMcqId, questionPayload);
        await qc.invalidateQueries({ queryKey: ["mcqs"] });

        toast.success("Question updated successfully!");
        setIsEditorOpen(false);
      }
    } catch (err: unknown) {
      toast.error("Failed to save question: " + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Question
  const handleDuplicate = async (mcq: Mcq) => {
    try {
      const copy = localStore.duplicateMcq(mcq.id);
      if (!copy) return;
      await qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success("Question duplicated successfully!");
    } catch (err: unknown) {
      toast.error("Duplicate failed: " + String(err));
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (mcq: Mcq) => {
    const isBookmarked = !mcq.is_bookmarked;
    try {
      localStore.updateMcq(mcq.id, { is_bookmarked: isBookmarked });
      await qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success(isBookmarked ? "Question bookmarked" : "Bookmark removed");
    } catch (err: unknown) {
      toast.error("Bookmark toggle failed: " + String(err));
    }
  };

  // Execute Deletion
  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const targetId = deleteTarget.id;
    try {
      localStore.deleteMcq(targetId);
      await qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success("Question deleted from Question Bank.");
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error("Delete failed: " + String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell
      title="Question Bank"
      subtitle="Create, organise and review questions across every subject"
      actions={
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast shadow-xs transition hover:opacity-90 active:scale-[0.99]"
        >
          <Plus className="size-3.5" />
          <span>New question</span>
        </button>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 pb-16">
        {/* Top Header Card Matching Screenshot 1 */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Question Bank
            </h1>
            <p className="mt-1 text-sm text-muted">
              Create, organise and review questions across every subject.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-xs transition hover:opacity-90 active:scale-[0.99] cursor-pointer"
          >
            <Plus className="size-4" />
            New question
          </motion.button>
        </motion.div>

        {/* Search Bar Input */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1] shadow-2xs"
          />
        </motion.div>

        {/* Structured Filter Bar with Pills Matching Screenshot 1 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.09 }}
          className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4 shadow-2xs"
        >
          {/* SUBJECT Filter Row */}
          <div className="space-y-1.5">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              SUBJECT
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId("all");
                  setSelectedChapterId("all");
                  setSelectedSourceId("all");
                }}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                  selectedSubjectId === "all"
                    ? "bg-[#6366F1] text-white shadow-xs"
                    : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                }`}
              >
                All
              </button>

              {subjects.map((sub) => {
                const isSelected = selectedSubjectId === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(sub.id);
                      setSelectedChapterId("all");
                      setSelectedSourceId("all");
                    }}
                    className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                      isSelected
                        ? "bg-[#6366F1] text-white shadow-xs"
                        : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CHAPTER Filter Row */}
          <div className="space-y-1.5">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              CHAPTER
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedChapterId("all");
                  setSelectedSourceId("all");
                }}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                  selectedChapterId === "all"
                    ? "bg-[#6366F1] text-white shadow-xs"
                    : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                }`}
              >
                All
              </button>

              {availableFilterChapters.map((ch) => {
                const isSelected = selectedChapterId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedChapterId(ch.id);
                      if (selectedSubjectId === "all") {
                        setSelectedSubjectId(ch.subject_id);
                      }
                      setSelectedSourceId("all");
                    }}
                    className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                      isSelected
                        ? "bg-[#6366F1] text-white shadow-xs"
                        : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                    }`}
                  >
                    {ch.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SOURCE Filter Row */}
          <div className="space-y-1.5">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              SOURCE
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedSourceId("all")}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                  selectedSourceId === "all"
                    ? "bg-[#6366F1] text-white shadow-xs"
                    : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                }`}
              >
                All
              </button>

              {availableFilterSources.map((src) => {
                const isSelected = selectedSourceId === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSelectedSourceId(src.id)}
                    className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                      isSelected
                        ? "bg-[#6366F1] text-white shadow-xs"
                        : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                    }`}
                  >
                    {src.title}
                  </button>
                );
              })}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted">
                Showing {filteredMcqs.length} of {mcqs.length} questions
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6366F1] hover:underline cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Reset all filters
              </button>
            </div>
          )}
        </motion.div>

        {/* Main Content Area with AnimatePresence for Subject / Chapter Transitions */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`qb-main-${selectedSubjectId}-${selectedChapterId}-${selectedSourceId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {filteredMcqs.length === 0 ? (
              /* Animated Empty State with Subtle Floating Motion & Guiding Options */
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-border/80 bg-gradient-to-b from-surface via-surface/90 to-surface-2/60 p-8 sm:p-10 text-center shadow-sm overflow-hidden"
              >
                {/* Subtle background glow */}
                <div className="pointer-events-none absolute -top-24 size-80 rounded-full bg-[#6366F1]/10 blur-3xl" />

                {/* Floating Animated Icon Badge */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                  className="relative flex size-16 items-center justify-center rounded-2xl bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/30 shadow-lg shadow-[#6366F1]/10"
                >
                  <CheckSquare className="size-8 text-[#8183f4]" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="absolute inset-0 rounded-2xl bg-[#6366F1]/20 -z-10 blur-sm"
                  />
                </motion.div>

                <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {hasActiveFilters ? "No matching questions found" : "Your Question Bank is empty"}
                </h3>

                <p className="mt-2 max-w-md text-xs sm:text-sm text-muted leading-relaxed">
                  {hasActiveFilters
                    ? "No questions match your current search queries or selected subject/chapter filters. Try adjusting or resetting your criteria."
                    : "Build your personalized MCQ repository manually or extract structured questions automatically from PDF study guides using Gemini AI."}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={hasActiveFilters ? clearAllFilters : handleOpenCreate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md transition hover:bg-[#5558E6] cursor-pointer"
                  >
                    {hasActiveFilters ? (
                      <>
                        <RotateCcw className="size-4" />
                        Clear all filters
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Create new MCQ
                      </>
                    )}
                  </motion.button>

                  {!hasActiveFilters && (
                    <Link to="/scanner">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-surface-2/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-surface-2 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="size-4 text-amber-400" />
                        <span>Import PDF / Scanner</span>
                      </motion.button>
                    </Link>
                  )}
                </div>
              </motion.div>
            ) : (
              /* Questions List */
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between px-1"
                >
                  <span className="text-xs font-medium text-muted">
                    Showing <strong className="text-foreground">{filteredMcqs.length}</strong>{" "}
                    questions
                  </span>
                </motion.div>

                <div className="space-y-3.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredMcqs.map((mcq, idx) => {
                      const sub = mcq.subject_id ? subjectMap.get(mcq.subject_id) : null;
                      const chap = mcq.chapter_id ? chapterMap.get(mcq.chapter_id) : null;
                      const src = mcq.source_id ? sourceMap.get(mcq.source_id) : null;
                      const isExplanationOpen = expandedExplanationIds.has(mcq.id);

                      return (
                        <motion.div
                          key={mcq.id}
                          layout
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{
                            duration: 0.24,
                            delay: Math.min(idx * 0.02, 0.25),
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          whileHover={{ y: -2 }}
                          className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-2xs transition-all hover:border-[#6366F1]/50 hover:shadow-sm"
                        >
                          {/* Header Badges & Actions */}
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex-1 space-y-2.5">
                              {/* Meta Pills */}
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-mono text-[11px] font-semibold text-muted">
                                  #{idx + 1}
                                </span>

                                {sub && (
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${colorClass(
                                      (sub.color || "cyan") as (typeof SUBJECT_COLORS)[number],
                                    )}`}
                                  >
                                    {sub.name}
                                  </span>
                                )}

                                {chap && (
                                  <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                                    {chap.name}
                                  </span>
                                )}

                                {src && (
                                  <span className="rounded-full border border-[#6366F1]/20 bg-[#6366F1]/5 px-2.5 py-0.5 text-[11px] font-medium text-[#6366F1]">
                                    {src.title}
                                  </span>
                                )}

                                <span
                                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
                                    mcq.difficulty === "easy"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : mcq.difficulty === "hard"
                                        ? "bg-rose/10 text-rose"
                                        : "bg-amber/10 text-amber"
                                  }`}
                                >
                                  {mcq.difficulty || "medium"}
                                </span>
                              </div>

                              {/* Question Prompt */}
                              <h3 className="text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                                {mcq.question}
                              </h3>

                              {/* 4 Options Grid Matching Layout */}
                              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                                {mcq.options?.map((opt, optIdx) => {
                                  const isCorrect = optIdx === mcq.correct_index;
                                  return (
                                    <motion.div
                                      key={optIdx}
                                      whileHover={{ scale: 1.005 }}
                                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all ${
                                        isCorrect
                                          ? "border-emerald-500/60 bg-emerald-500/10 font-medium text-foreground ring-1 ring-emerald-500/30"
                                          : "border-border bg-surface-2/40 text-muted hover:border-border/80"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span
                                          className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                            isCorrect
                                              ? "bg-emerald-500 text-white shadow-2xs"
                                              : "bg-surface-2 text-muted"
                                          }`}
                                        >
                                          {OPTION_KEYS[optIdx] || optIdx + 1}
                                        </span>
                                        <span className="leading-snug">{opt}</span>
                                      </div>

                                      {isCorrect && (
                                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                          <CheckCircle2 className="size-3.5" />
                                          Correct
                                        </span>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </div>

                              {/* Explanation Toggle */}
                              {mcq.explanation && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleExplanation(mcq.id)}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6366F1] hover:underline cursor-pointer"
                                  >
                                    <HelpCircle className="size-3.5" />
                                    {isExplanationOpen
                                      ? "Hide Explanation"
                                      : "View Explanation & Reasoning"}
                                    {isExplanationOpen ? (
                                      <ChevronUp className="size-3.5" />
                                    ) : (
                                      <ChevronDown className="size-3.5" />
                                    )}
                                  </button>

                                  <AnimatePresence>
                                    {isExplanationOpen && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                        animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="rounded-xl border border-border bg-surface-2/50 p-3.5 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                                          <p className="font-semibold text-muted mb-1 font-mono text-[10px] uppercase tracking-wider">
                                            Reasoning / Solution
                                          </p>
                                          {mcq.explanation}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                              {/* Bookmark Button */}
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => handleToggleBookmark(mcq)}
                                className={`rounded-lg border border-border p-2 transition cursor-pointer hover:bg-surface-2 ${
                                  mcq.is_bookmarked
                                    ? "text-[#6366F1] bg-[#6366F1]/10 border-[#6366F1]/30"
                                    : "text-muted hover:text-foreground"
                                }`}
                                title={mcq.is_bookmarked ? "Remove bookmark" : "Bookmark question"}
                              >
                                {mcq.is_bookmarked ? (
                                  <BookmarkCheck className="size-4" />
                                ) : (
                                  <Bookmark className="size-4" />
                                )}
                              </motion.button>

                              {/* Edit Button */}
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => handleOpenEdit(mcq)}
                                className="rounded-lg border border-border p-2 text-muted transition cursor-pointer hover:bg-[#6366F1]/10 hover:text-[#6366F1]"
                                title="Edit question"
                              >
                                <Edit3 className="size-4" />
                              </motion.button>

                              {/* Duplicate Button */}
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => handleDuplicate(mcq)}
                                className="rounded-lg border border-border p-2 text-muted transition cursor-pointer hover:bg-surface-2 hover:text-foreground"
                                title="Duplicate question"
                              >
                                <Copy className="size-4" />
                              </motion.button>

                              {/* Delete Button */}
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => setDeleteTarget(mcq)}
                                className="rounded-lg border border-border p-2 text-muted transition cursor-pointer hover:bg-rose/10 hover:text-rose"
                                title="Delete question"
                              >
                                <Trash2 className="size-4" />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* New Question Modal Matching Screenshot 2 Exactly */}
        <AnimatePresence>
          {isEditorOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-question-modal-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-border px-6 py-4">
                  <div>
                    <h2 id="new-question-modal-title" className="text-lg font-bold text-foreground">
                      {editorMode === "create" ? "New question" : "Edit question"}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Add a question with its answer and explanation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-foreground cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Modal Scrollable Form */}
                <form
                  onSubmit={handleSaveQuestion}
                  className="flex-1 overflow-y-auto p-6 space-y-4"
                >
                  {/* Row 1: Subject, Chapter, Source (3 columns) */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="form-subject-select"
                        className="block text-xs font-semibold text-foreground mb-1.5"
                      >
                        Subject
                      </label>
                      <select
                        id="form-subject-select"
                        value={formSubjectId}
                        onChange={(e) => handleFormSubjectChange(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                        required
                      >
                        <option value="">Select a subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="form-chapter-select"
                        className="block text-xs font-semibold text-foreground mb-1.5"
                      >
                        Chapter
                      </label>
                      <select
                        id="form-chapter-select"
                        value={formChapterId}
                        onChange={(e) => handleFormChapterChange(e.target.value)}
                        disabled={!formSubjectId}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground disabled:bg-surface-2 disabled:text-muted focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                      >
                        <option value="">
                          {!formSubjectId ? "Select a subject first" : "Select a chapter"}
                        </option>
                        {availableFormChapters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="form-source-select"
                        className="block text-xs font-semibold text-foreground mb-1.5"
                      >
                        Source
                      </label>
                      <select
                        id="form-source-select"
                        value={formSourceId}
                        onChange={(e) => setFormSourceId(e.target.value)}
                        disabled={!formChapterId}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground disabled:bg-surface-2 disabled:text-muted focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                      >
                        <option value="">
                          {!formChapterId
                            ? "Select a chapter first"
                            : availableFormSources.length === 0
                              ? "None (Optional)"
                              : "Select a source"}
                        </option>
                        {availableFormSources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Question Type */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="form-question-type-select"
                        className="block text-xs font-semibold text-foreground mb-1.5"
                      >
                        Question type
                      </label>
                      <select
                        id="form-question-type-select"
                        value={formQuestionType}
                        onChange={(e) => setFormQuestionType(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                      >
                        <option value="multiple_choice">Multiple choice</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="form-difficulty-select"
                        className="block text-xs font-semibold text-foreground mb-1.5"
                      >
                        Difficulty
                      </label>
                      <select
                        id="form-difficulty-select"
                        value={formDifficulty}
                        onChange={(e) =>
                          setFormDifficulty(e.target.value as "easy" | "medium" | "hard")
                        }
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Question Prompt */}
                  <div>
                    <label
                      htmlFor="form-prompt-textarea"
                      className="block text-xs font-semibold text-foreground mb-1.5"
                    >
                      Question
                    </label>
                    <textarea
                      id="form-prompt-textarea"
                      rows={3}
                      placeholder="Write the question prompt..."
                      value={formPrompt}
                      onChange={(e) => setFormPrompt(e.target.value)}
                      required
                      className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                    />
                  </div>

                  {/* Row 4: Options 2x2 Grid Matching Screenshot 2 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-foreground">Options</label>
                      <span className="text-[11px] text-muted">
                        Select the circle next to the correct option.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {OPTION_KEYS.map((optKey, optIdx) => {
                        const isCorrect = formCorrectIndex === optIdx;
                        return (
                          <div
                            key={optKey}
                            className={`relative flex items-center rounded-xl border bg-surface transition ${
                              isCorrect
                                ? "border-[#6366F1] ring-1 ring-[#6366F1]/30 bg-[#6366F1]/5"
                                : "border-border"
                            }`}
                          >
                            {/* Radio Button to Mark Correct Option */}
                            <button
                              type="button"
                              onClick={() => setFormCorrectIndex(optIdx)}
                              className="pl-3 pr-1 text-muted transition hover:text-[#6366F1]"
                              title={`Mark Option ${optKey} as correct`}
                              aria-label={`Mark Option ${optKey} as correct`}
                            >
                              <div
                                className={`flex size-4 items-center justify-center rounded-full border ${
                                  isCorrect
                                    ? "border-[#6366F1] bg-[#6366F1]"
                                    : "border-border bg-surface"
                                }`}
                              >
                                {isCorrect && <div className="size-1.5 rounded-full bg-white" />}
                              </div>
                            </button>

                            {/* Option Input */}
                            <input
                              type="text"
                              placeholder={`Option ${optKey}`}
                              value={formOptions[optIdx]}
                              onChange={(e) => {
                                const updated: [string, string, string, string] = [...formOptions];
                                updated[optIdx] = e.target.value;
                                setFormOptions(updated);
                              }}
                              required
                              className="w-full bg-transparent py-2.5 pl-2 pr-8 text-xs text-foreground placeholder:text-muted focus:outline-hidden"
                            />

                            {/* Right Badge A/B/C/D */}
                            <span className="pointer-events-none absolute right-3 font-mono text-xs font-bold text-muted">
                              {optKey}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 5: Explanation */}
                  <div>
                    <label
                      htmlFor="form-explanation-textarea"
                      className="block text-xs font-semibold text-foreground mb-1.5"
                    >
                      Explanation
                    </label>
                    <textarea
                      id="form-explanation-textarea"
                      rows={3}
                      placeholder="Explain the reasoning behind the correct answer..."
                      value={formExplanation}
                      onChange={(e) => setFormExplanation(e.target.value)}
                      className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted focus:border-[#6366F1] focus:outline-hidden focus:ring-1 focus:ring-[#6366F1]"
                    />
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(false)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#5558E6] active:scale-[0.99] cursor-pointer"
                    >
                      {isSaving
                        ? "Saving..."
                        : editorMode === "create"
                          ? "Create question"
                          : "Update question"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-md rounded-2xl border border-rose/30 bg-surface p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose/10 text-rose">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 id="delete-modal-title" className="text-base font-bold text-foreground">
                      Delete question?
                    </h3>
                    <p className="text-xs text-muted">
                      This will permanently remove this question from your Question Bank.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-2/50 p-3 text-xs text-foreground line-clamp-3">
                  "{deleteTarget.question}"
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted hover:bg-surface-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDelete}
                    disabled={isDeleting}
                    className="rounded-xl bg-rose px-4 py-2 text-xs font-medium text-white hover:bg-rose/90 cursor-pointer"
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
