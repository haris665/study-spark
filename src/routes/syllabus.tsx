import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Filter,
  Search,
  UploadCloud,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  HelpCircle,
  Flame,
  Layers,
  AlertTriangle,
  Target,
  FileText,
  Check,
  X,
  Library,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import {
  Panel,
  Btn,
  Input,
  Textarea,
  Select,
  Field,
  Empty,
  Tag,
  Badge,
} from "@/components/app/kit";
import { McqCard } from "@/components/app/McqCard";
import { McqModal } from "@/components/app/McqModal";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { localStore } from "@/lib/local-store";
import { extractSyllabus } from "@/lib/ai.functions";
import { formatSM2DueDate } from "@/lib/sm2";
import {
  subjectsQuery,
  chaptersQuery,
  topicsQuery,
  sourcesQuery,
  mcqsQuery,
  profileQuery,
  SUBJECT_COLORS,
  colorClass,
  colorStroke,
  type Subject,
  type Chapter,
  type Topic,
  type Source,
  type Mcq,
} from "@/lib/queries";

export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Content Bank & Syllabus — Study Spark" },
      {
        name: "description",
        content: "Syllabus hierarchy, Content Bank, Reference Sources, and Formatted MCQs.",
      },
      { property: "og:title", content: "Content Bank & Syllabus — Study Spark" },
      {
        property: "og:description",
        content: "Syllabus hierarchy, Content Bank, Reference Sources, and Formatted MCQs.",
      },
    ],
  }),
  component: Syllabus,
});

function Syllabus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Navigation / Selection State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"content_bank" | "topics_tracker">("content_bank");

  // Source Form State
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceKind, setSourceKind] = useState("book");
  const [sourceReference, setSourceReference] = useState("");
  const [sourceTags, setSourceTags] = useState("");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);

  // MCQ View and Filter State
  const [mcqViewMode, setMcqViewMode] = useState<"compact" | "formatted">("compact");
  const [mcqGridLayout, setMcqGridLayout] = useState<"grid" | "list">("list");
  const [isFullWidthMode, setIsFullWidthMode] = useState(false);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [expandedMcqIds, setExpandedMcqIds] = useState<Record<string, boolean>>({});
  const [mcqSearchQuery, setMcqSearchQuery] = useState("");
  const [mcqDifficultyFilter, setMcqDifficultyFilter] = useState<
    "all" | "easy" | "medium" | "hard"
  >("all");
  const [mcqSourceFilter, setMcqSourceFilter] = useState<string>("all");
  const [mcqStatusFilter, setMcqStatusFilter] = useState<string>("all");

  // MCQ Modal State
  const [isMcqModalOpen, setIsMcqModalOpen] = useState(false);
  const [editingMcq, setEditingMcq] = useState<Mcq | null>(null);

  // Topic Tracker Filters & Search
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [topicStatusFilter, setTopicStatusFilter] = useState<
    "all" | "not_started" | "in_progress" | "completed" | "not_studied" | "studying" | "done"
  >("all");
  const [topicConfidenceFilter, setTopicConfidenceFilter] = useState<
    "all" | "low" | "medium" | "high" | "med"
  >("all");
  const [topicPriorityFilter, setTopicPriorityFilter] = useState<"all" | "high" | "med" | "low">(
    "all",
  );
  const [topicSortBy, setTopicSortBy] = useState<"priority" | "due" | "name">("priority");

  // Add Item States
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState<string>("accent");
  const [newChapterName, setNewChapterName] = useState("");
  const [newTopicName, setNewTopicName] = useState("");

  // Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    table: "subjects" | "chapters" | "topics" | "sources" | "mcqs";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<{
    exam_name?: string;
    subjects: {
      name: string;
      color?: string;
      chapters: {
        name: string;
        topics: string[];
      }[];
    }[];
  } | null>(null);

  // Queries
  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: topics = [] } = useQuery({ ...topicsQuery(), enabled: !!user });
  const { data: sources = [] } = useQuery({ ...sourcesQuery(), enabled: !!user });
  const { data: mcqs = [] } = useQuery({ ...mcqsQuery(), enabled: !!user });

  // Default active subject
  const activeSubject = useMemo(() => {
    if (selectedSubjectId) {
      const found = subjects.find((s) => s.id === selectedSubjectId);
      if (found) return found;
    }
    const englishSub = subjects.find(
      (s) => s.name.toLowerCase() === "english" || s.name.toLowerCase().includes("english"),
    );
    return englishSub ?? subjects[0] ?? null;
  }, [subjects, selectedSubjectId]);

  const subjectChapters = useMemo(
    () => chapters.filter((c) => c.subject_id === activeSubject?.id),
    [chapters, activeSubject],
  );

  // Default active chapter
  const activeChapter = useMemo(() => {
    if (selectedChapterId) {
      const found = subjectChapters.find((c) => c.id === selectedChapterId);
      if (found) return found;
    }
    const quaidChap = subjectChapters.find((c) => c.name.toLowerCase().includes("quaid"));
    return quaidChap ?? subjectChapters[0] ?? null;
  }, [subjectChapters, selectedChapterId]);

  const chapterTopics = useMemo(
    () => topics.filter((t) => t.chapter_id === activeChapter?.id),
    [topics, activeChapter],
  );

  const chapterSources = useMemo(
    () => sources.filter((s) => s.chapter_id === activeChapter?.id),
    [sources, activeChapter],
  );

  const chapterMcqs = useMemo(
    () => mcqs.filter((m) => m.chapter_id === activeChapter?.id),
    [mcqs, activeChapter],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["subjects"] });
    qc.invalidateQueries({ queryKey: ["chapters"] });
    qc.invalidateQueries({ queryKey: ["topics"] });
    qc.invalidateQueries({ queryKey: ["sources"] });
    qc.invalidateQueries({ queryKey: ["mcqs"] });
  };

  const run = useMutation({
    mutationFn: async (fn: () => Promise<{ error: { message: string } | null }>) => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  // Add Subject Handler
  const handleAddSubject = () => {
    if (!newSubjectName.trim() || !user) return;
    const trimmed = newSubjectName.trim();
    localStore.addSubject({
      name: trimmed,
      color: newSubjectColor,
      description: null,
      position: subjects.length,
    });
    run.mutate(
      () =>
        supabase.from("subjects").insert({
          user_id: user.id,
          name: trimmed,
          color: newSubjectColor,
          position: subjects.length,
        }) as never,
      {
        onSuccess: () => {
          setNewSubjectName("");
          toast.success(`Subject "${trimmed}" added`);
        },
      },
    );
  };

  // Add Chapter Handler
  const handleAddChapter = () => {
    if (!newChapterName.trim() || !user || !activeSubject) return;
    const trimmed = newChapterName.trim();
    localStore.addChapter({
      subject_id: activeSubject.id,
      name: trimmed,
      description: null,
      position: subjectChapters.length,
    });
    run.mutate(
      () =>
        supabase.from("chapters").insert({
          user_id: user.id,
          subject_id: activeSubject.id,
          name: trimmed,
          position: subjectChapters.length,
        }) as never,
      {
        onSuccess: () => {
          setNewChapterName("");
          toast.success(`Chapter "${trimmed}" added`);
        },
      },
    );
  };

  // Add or Update Source Handler
  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceTitle.trim() || !activeChapter) {
      toast.error("Please enter a source title");
      return;
    }

    const tagsArray = sourceTags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    if (editingSourceId) {
      try {
        await supabase
          .from("sources")
          .update({
            title: sourceTitle.trim(),
            kind: sourceKind.trim() || "book",
            reference: sourceReference.trim() || null,
            tags: tagsArray,
          })
          .eq("id", editingSourceId);
      } catch (err) {
        console.warn("Supabase update source warning:", err);
      }
      toast.success("Source updated");
      setEditingSourceId(null);
    } else {
      try {
        await supabase.from("sources").insert({
          user_id: user.id,
          chapter_id: activeChapter.id,
          title: sourceTitle.trim(),
          kind: sourceKind.trim() || "book",
          reference: sourceReference.trim() || null,
          tags: tagsArray,
        });
      } catch (err) {
        console.warn("Supabase insert source warning:", err);
      }
      toast.success("Source added");
    }

    setSourceTitle("");
    setSourceKind("book");
    setSourceReference("");
    setSourceTags("");
    refresh();
  };

  const handleStartEditSource = (s: Source) => {
    setEditingSourceId(s.id);
    setSourceTitle(s.title);
    setSourceKind(s.kind || "book");
    setSourceReference(s.reference || "");
    setSourceTags((s.tags || []).join(", "));
  };

  const handleCancelEditSource = () => {
    setEditingSourceId(null);
    setSourceTitle("");
    setSourceKind("book");
    setSourceReference("");
    setSourceTags("");
  };

  // MCQ Modal Handlers
  const handleOpenAddMcq = () => {
    setEditingMcq(null);
    setIsMcqModalOpen(true);
  };

  const handleOpenEditMcq = (m: Mcq) => {
    setEditingMcq(m);
    setIsMcqModalOpen(true);
  };

  const handleSaveMcq = async (data: {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    difficulty: string;
    source_id: string | null;
    tags: string[];
    status: string;
  }) => {
    if (!activeChapter) return;

    if (editingMcq) {
      localStore.updateMcq(editingMcq.id, {
        question: data.question,
        options: data.options,
        correct_index: data.correct_index,
        explanation: data.explanation || null,
        difficulty: data.difficulty,
        source_id: data.source_id,
        tags: data.tags,
        status: data.status,
      });
      try {
        await supabase
          .from("mcqs")
          .update({
            question: data.question,
            options: data.options,
            correct_index: data.correct_index,
            explanation: data.explanation || null,
            difficulty: data.difficulty,
            source_id: data.source_id,
            tags: data.tags,
            status: data.status,
          })
          .eq("id", editingMcq.id);
      } catch (err) {
        console.warn("Supabase update mcq warning:", err);
      }
      toast.success("MCQ updated successfully");
    } else {
      localStore.addMcq({
        subject_id: activeSubject?.id || null,
        chapter_id: activeChapter.id,
        source_id: data.source_id,
        question: data.question,
        options: data.options,
        correct_index: data.correct_index,
        explanation: data.explanation || null,
        difficulty: data.difficulty,
        tags: data.tags,
        status: data.status,
        origin: "syllabus",
      });
      try {
        await supabase.from("mcqs").insert({
          user_id: user.id,
          subject_id: activeSubject?.id || null,
          chapter_id: activeChapter.id,
          source_id: data.source_id,
          question: data.question,
          options: data.options,
          correct_index: data.correct_index,
          explanation: data.explanation || null,
          difficulty: data.difficulty,
          tags: data.tags,
          status: data.status,
          origin: "syllabus",
        });
      } catch (err) {
        console.warn("Supabase insert mcq warning:", err);
      }
      toast.success("MCQ created successfully");
    }

    setIsMcqModalOpen(false);
    setEditingMcq(null);
    refresh();
  };

  const toggleExpandMcq = (id: string) => {
    setExpandedMcqIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered MCQs for the Active Chapter
  const filteredChapterMcqs = useMemo(() => {
    return chapterMcqs.filter((m) => {
      if (mcqSearchQuery.trim()) {
        const q = mcqSearchQuery.toLowerCase();
        const matchQ = m.question.toLowerCase().includes(q);
        const matchOpts = (m.options || []).some((opt) => opt.toLowerCase().includes(q));
        const matchExp = (m.explanation || "").toLowerCase().includes(q);
        const matchTags = (m.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchQ && !matchOpts && !matchExp && !matchTags) return false;
      }
      if (mcqDifficultyFilter !== "all") {
        if ((m.difficulty || "medium").toLowerCase() !== mcqDifficultyFilter.toLowerCase())
          return false;
      }
      if (mcqStatusFilter !== "all") {
        if ((m.status || "approved").toLowerCase() !== mcqStatusFilter.toLowerCase()) return false;
      }
      if (mcqSourceFilter !== "all") {
        if (m.source_id !== mcqSourceFilter) return false;
      }
      return true;
    });
  }, [chapterMcqs, mcqSearchQuery, mcqDifficultyFilter, mcqStatusFilter, mcqSourceFilter]);

  // Topic Tracker Functions
  const handleAddTopic = () => {
    if (!newTopicName.trim() || !user || !activeChapter) return;
    const nowIso = new Date().toISOString();
    localStore.addTopic({
      chapter_id: activeChapter.id,
      name: newTopicName.trim(),
      status: "not_studied",
      completion: "not_started",
      confidence: "medium",
      priority: "med",
      last_studied_at: null,
      due_at: nowIso,
      due_review_at: nowIso,
      interval_days: 1,
      ease_factor: 2.5,
      repetitions: 0,
    });
    run.mutate(
      () =>
        supabase.from("topics").insert({
          user_id: user.id,
          chapter_id: activeChapter.id,
          name: newTopicName.trim(),
          completion: "not_started",
          confidence: "medium",
          last_studied_at: null,
          due_review_at: nowIso,
          tags: [],
        }) as never,
      {
        onSuccess: () => {
          setNewTopicName("");
          toast.success("Topic added");
        },
      },
    );
  };

  const updateTopicStatus = (topic: Topic, newStatus: string) => {
    localStore.updateTopic(topic.id, {
      status: newStatus as Topic["status"],
      last_studied_at:
        newStatus === "completed" || newStatus === "done"
          ? new Date().toISOString()
          : topic.last_studied_at,
    });
    run.mutate(
      () =>
        supabase
          .from("topics")
          .update({
            completion:
              newStatus === "done"
                ? "completed"
                : newStatus === "studying"
                  ? "in_progress"
                  : "not_started",
            last_studied_at:
              newStatus === "completed" || newStatus === "done"
                ? new Date().toISOString()
                : topic.last_studied_at,
          })
          .eq("id", topic.id) as never,
      {
        onSuccess: () => {
          toast.success(`Marked as ${newStatus.replace("_", " ")}`);
        },
      },
    );
  };

  const updateTopicConfidence = (topic: Topic, newConfidence: string) => {
    localStore.updateTopic(topic.id, { confidence: newConfidence as Topic["confidence"] });
    run.mutate(
      () =>
        supabase.from("topics").update({ confidence: newConfidence }).eq("id", topic.id) as never,
      {
        onSuccess: () => {
          toast.success(`Confidence set to ${newConfidence}`);
        },
      },
    );
  };

  const handleAutoMigrateTags = () => {
    const res = localStore.autoMigrateTagsToTopicsAndLinkMcqs();
    refresh();
    toast.success(
      `Migrated tags: ${res.topicsAdded} new topics created, ${res.mcqsLinked} MCQs linked!`,
    );
  };

  // Filtered Topics for Topic Tracker
  const filteredTopics = useMemo(() => {
    const priorityWeight: Record<string, number> = { high: 3, med: 2, medium: 2, low: 1 };

    const filtered = chapterTopics.filter((t) => {
      const matchesSearch = topicSearchQuery
        ? t.name.toLowerCase().includes(topicSearchQuery.toLowerCase())
        : true;

      const tStatus =
        t.status ||
        (t.completion === "completed"
          ? "done"
          : t.completion === "in_progress"
            ? "studying"
            : "not_studied");
      const matchesStatus =
        topicStatusFilter === "all"
          ? true
          : topicStatusFilter === "not_studied" || topicStatusFilter === "not_started"
            ? tStatus === "not_studied" || tStatus === "not_started"
            : topicStatusFilter === "studying" || topicStatusFilter === "in_progress"
              ? tStatus === "studying" || tStatus === "in_progress"
              : tStatus === "done" || tStatus === "completed";

      const tConf = t.confidence === "medium" ? "med" : t.confidence || "med";
      const filterConf = topicConfidenceFilter === "medium" ? "med" : topicConfidenceFilter;
      const matchesConfidence = filterConf === "all" ? true : tConf === filterConf;

      const tPrio = t.priority === "medium" ? "med" : t.priority || "med";
      const filterPrio = topicPriorityFilter === "medium" ? "med" : topicPriorityFilter;
      const matchesPriority = filterPrio === "all" ? true : tPrio === filterPrio;

      return matchesSearch && matchesStatus && matchesConfidence && matchesPriority;
    });

    return filtered.sort((a, b) => {
      if (topicSortBy === "priority") {
        const wA = priorityWeight[a.priority || "med"] || 2;
        const wB = priorityWeight[b.priority || "med"] || 2;
        return wB - wA;
      }
      if (topicSortBy === "due") {
        const dueA = new Date(a.due_at || a.due_review_at || Date.now()).getTime();
        const dueB = new Date(b.due_at || b.due_review_at || Date.now()).getTime();
        return dueA - dueB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    chapterTopics,
    topicSearchQuery,
    topicStatusFilter,
    topicConfidenceFilter,
    topicPriorityFilter,
    topicSortBy,
  ]);

  // Delete Prompt
  const promptDeleteItem = (
    table: "subjects" | "chapters" | "topics" | "sources" | "mcqs",
    id: string,
    name: string,
  ) => {
    setDeleteConfirmTarget({ table, id, name });
  };

  const executeConfirmedDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { table, id, name } = deleteConfirmTarget;
    const label =
      table === "subjects"
        ? "Subject"
        : table === "chapters"
          ? "Chapter"
          : table === "topics"
            ? "Topic"
            : table === "sources"
              ? "Reference Source"
              : "MCQ";

    setIsDeleting(true);
    try {
      if (table === "subjects") {
        localStore.deleteSubject(id);
      } else if (table === "chapters") {
        localStore.deleteChapter(id);
      } else if (table === "topics") {
        localStore.deleteTopic(id);
      } else if (table === "sources") {
        localStore.deleteSource(id);
      } else if (table === "mcqs") {
        localStore.deleteMcq(id);
      }

      try {
        await supabase.from(table).delete().eq("id", id);
      } catch (adapterErr) {
        console.warn("Adapter deletion warning:", adapterErr);
      }

      if (table === "subjects") {
        setSelectedSubjectId((curr) => (curr === id ? null : curr));
        setSelectedChapterId(null);
      } else if (table === "chapters") {
        setSelectedChapterId((curr) => (curr === id ? null : curr));
      }

      refresh();
      toast.success(`${label} permanently deleted`);
      setDeleteConfirmTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to delete ${label}: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // AI Extract Syllabus Handler
  const handleExtractSyllabus = async () => {
    if (!importRawText.trim()) {
      toast.error("Please paste your syllabus or course outline text first.");
      return;
    }
    setIsExtracting(true);
    try {
      const result = await extractSyllabus({ data: { rawContent: importRawText } });
      if (result.syllabus && result.syllabus.length > 0) {
        setExtractedPreview({
          subjects: result.syllabus.map((s) => ({
            name: s.subject,
            color: "accent",
            chapters: s.chapters.map((c) => ({
              name: c.name,
              topics: c.topics.map((t) => t.name),
            })),
          })),
        });
        toast.success("Syllabus parsed successfully! Review the hierarchy before importing.");
      } else {
        toast.error("Could not parse syllabus structure. Try a simpler outline format.");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCommitExtractedSyllabus = async () => {
    if (!extractedPreview || !user) return;
    try {
      for (const [sIdx, s] of extractedPreview.subjects.entries()) {
        const subRes = (await supabase.from("subjects").insert({
          user_id: user.id,
          name: s.name,
          color: s.color || "accent",
          position: subjects.length + sIdx,
        })) as { data: { id?: string } | Array<{ id?: string }> | null };
        const createdSub = Array.isArray(subRes?.data) ? subRes.data[0] : subRes?.data;
        const subId = createdSub?.id;

        if (subId && s.chapters) {
          for (const [cIdx, ch] of s.chapters.entries()) {
            const chRes = (await supabase.from("chapters").insert({
              user_id: user.id,
              subject_id: subId,
              name: ch.name,
              position: cIdx,
            })) as { data: { id?: string } | Array<{ id?: string }> | null };
            const createdCh = Array.isArray(chRes?.data) ? chRes.data[0] : chRes?.data;
            const chId = createdCh?.id;

            if (chId && ch.topics) {
              for (const topName of ch.topics) {
                await supabase.from("topics").insert({
                  chapter_id: chId,
                  name: topName,
                  completion: "not_started",
                  confidence: "medium",
                  last_studied_at: null,
                  due_review_at: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
      refresh();
      setImportModalOpen(false);
      setExtractedPreview(null);
      setImportRawText("");
      toast.success("Syllabus hierarchy imported successfully!");
    } catch (err) {
      toast.error("Failed to commit imported syllabus: " + String(err));
    }
  };

  return (
    <AppShell
      title="Syllabus & Content Bank"
      subtitle={
        profile?.exam_name
          ? `Exam Target: ${profile.exam_name}`
          : "Exam · Subject · Chapter · Reference Sources · MCQs"
      }
      actions={
        <div className="flex items-center gap-2">
          <Btn
            variant="outline"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Sparkles className="size-3.5 text-teal-400" />
            AI Bulk Import
          </Btn>
        </div>
      }
    >
      <div className="syllabus-page space-y-6">
        {/* Screenshot-Matched Header Bar: Content Bank / in {Chapter}, {Subject} */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-2xl font-serif font-bold text-foreground tracking-tight">
              Content Bank
            </h1>
            <span className="text-muted text-sm italic font-serif">
              / in {activeChapter ? activeChapter.name : "All Chapters"}
              {activeSubject ? `, ${activeSubject.name}` : ""}
            </span>
          </div>

          {/* Counts readout directly matching screenshot */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] uppercase tracking-widest text-faint">
            <span>
              {subjects.length} {subjects.length === 1 ? "SUBJECT" : "SUBJECTS"}
            </span>
            <span>·</span>
            <span>
              {chapters.length} {chapters.length === 1 ? "CHAPTER" : "CHAPTERS"}
            </span>
            <span>·</span>
            <span>
              {sources.length} {sources.length === 1 ? "SOURCE" : "SOURCES"}
            </span>
            <span>·</span>
            <span>
              {mcqs.length} {mcqs.length === 1 ? "QUESTION" : "QUESTIONS"}
            </span>
          </div>
        </div>

        {/* View Switcher Tabs: Content Bank (Sources & MCQs) vs Topics & SM-2 Tracker */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-border bg-surface-2/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("content_bank")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "content_bank"
                  ? "bg-teal-400 text-teal-950 shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Library className="size-3.5" />
              Content Bank & Sources
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("topics_tracker")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "topics_tracker"
                  ? "bg-teal-400 text-teal-950 shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Target className="size-3.5" />
              Topics & SM-2 Tracker
            </button>
            <Link
              to="/question-bank"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition-all cursor-pointer"
              title="Jump to Full Question Bank"
            >
              <CheckSquare className="size-3.5 text-teal-400" />
              <span>Question Bank</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {activeChapter && (
              <Link
                to="/practice"
                search={{ chapterId: activeChapter.id }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2/80 px-3.5 py-2 text-xs font-medium text-foreground hover:border-teal-500/50 hover:bg-teal-400/10 transition-all"
              >
                <Play className="size-3.5 text-teal-400" /> Practice Entire Chapter
              </Link>
            )}
          </div>
        </div>

        {/* Hierarchy Grid or Full-Width Focused View */}
        <div
          className={
            isFullWidthMode ? "w-full space-y-6" : "grid gap-6 lg:grid-cols-[210px_230px_minmax(0,1fr)]"
          }
        >
          {/* ========================================================================= */}
          {/* 1. Subjects Column (matching image.png) */}
          {/* ========================================================================= */}
          {!isFullWidthMode && (
            <Panel className="h-fit border border-border/70 bg-surface/90">
              <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Subjects</h2>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-faint">
                  {subjects.length}
                </span>
              </div>

              <div className="mt-3">
                <ul className="space-y-1.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {subjects.map((s, idx) => {
                      const active = s.id === activeSubject?.id;
                      const sChapters = chapters.filter((c) => c.subject_id === s.id);
                      return (
                        <motion.li
                          key={s.id}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.2) }}
                        >
                          <div
                            className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                              active
                                ? "bg-teal-950/50 border border-teal-500/50 text-teal-200 font-medium shadow-xs"
                                : "border border-transparent bg-surface-2/30 text-muted hover:border-border hover:text-foreground"
                            }`}
                          >
                            {active && (
                              <motion.div
                                layoutId="active-subject-indicator"
                                className="absolute inset-0 rounded-xl bg-teal-500/10 border border-teal-500/30 pointer-events-none"
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubjectId(s.id);
                                setSelectedChapterId(null);
                              }}
                              className="relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                            >
                              <span
                                className={`size-2 shrink-0 rounded-full transition-colors ${
                                  active ? "bg-teal-400 ring-2 ring-teal-400/20" : "bg-muted/60"
                                }`}
                              />
                              <span className="truncate">{s.name}</span>
                            </button>

                            <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                              <span
                                className={`font-mono text-[10px] ${
                                  active ? "text-teal-300 font-semibold" : "text-faint"
                                }`}
                              >
                                {sChapters.length}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  promptDeleteItem("subjects", s.id, s.name);
                                }}
                                className="opacity-0 group-hover:opacity-100 rounded p-1 text-faint transition-opacity hover:text-rose cursor-pointer"
                                title={`Delete subject "${s.name}"`}
                                aria-label={`Delete subject "${s.name}"`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>

              {/* Add Subject Form with Teal Button matching screenshot */}
              <div className="mt-4 space-y-2 border-t border-border/60 pt-3.5">
                <Input
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                  placeholder="New subject name"
                  className="text-xs bg-surface-2/60"
                />
                <button
                  type="button"
                  onClick={handleAddSubject}
                  className="w-full rounded-lg bg-teal-400 hover:bg-teal-300 text-teal-950 font-semibold text-xs py-2 px-3 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                >
                  Add subject
                </button>
              </div>
            </Panel>
          )}

          {/* ========================================================================= */}
          {/* 2. Chapters Column (matching image.png) */}
          {/* ========================================================================= */}
          {!isFullWidthMode && (
            <Panel className="h-fit border border-border/70 bg-surface/90">
              <div className="flex items-baseline justify-between pb-2.5 border-b border-border/60">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Chapters</h2>
                  {activeSubject && (
                    <p className="text-[11px] text-muted italic font-serif">
                      in {activeSubject.name}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-faint">
                  {subjectChapters.length}
                </span>
              </div>

              {!activeSubject ? (
                <p className="mt-4 text-xs text-muted">Select a subject on the left.</p>
              ) : (
                <>
                  <div className="mt-3">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.ul
                        key={activeSubject?.id || "empty"}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-1.5"
                      >
                        {subjectChapters.map((c, idx) => {
                          const active = c.id === activeChapter?.id;
                          const cMcqs = mcqs.filter((m) => m.chapter_id === c.id);
                          const formattedIndex = String(idx + 1).padStart(2, "0");
                          return (
                            <motion.li
                              key={c.id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.2) }}
                            >
                              <div
                                className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                                  active
                                    ? "bg-teal-950/50 border border-teal-500/50 text-teal-200 font-medium shadow-xs"
                                    : "border border-transparent bg-surface-2/30 text-muted hover:border-border hover:text-foreground"
                                }`}
                              >
                                {active && (
                                  <motion.div
                                    layoutId="active-chapter-indicator"
                                    className="absolute inset-0 rounded-xl bg-teal-500/10 border border-teal-500/30 pointer-events-none"
                                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedChapterId(c.id)}
                                  className="relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                                >
                                  <span
                                    className={`font-mono text-[10px] font-semibold ${active ? "text-teal-400" : "text-faint"}`}
                                  >
                                    {formattedIndex}
                                  </span>
                                  <span className="truncate">{c.name}</span>
                                </button>

                                <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`font-mono text-[10px] ${active ? "text-teal-300 font-semibold" : "text-faint"}`}
                                  >
                                    {cMcqs.length}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      promptDeleteItem("chapters", c.id, c.name);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-faint transition-opacity hover:text-rose cursor-pointer"
                                    title={`Delete chapter "${c.name}"`}
                                    aria-label={`Delete chapter "${c.name}"`}
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              </div>
                            </motion.li>
                          );
                        })}
                        {subjectChapters.length === 0 && (
                          <motion.li
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="px-2 py-4 text-center text-xs text-muted"
                          >
                            No chapters in this subject yet.
                          </motion.li>
                        )}
                      </motion.ul>
                    </AnimatePresence>
                  </div>

                  {/* Add Chapter Form with Teal Button matching screenshot */}
                  <div className="mt-4 space-y-2 border-t border-border/60 pt-3.5">
                    <Input
                      value={newChapterName}
                      onChange={(e) => setNewChapterName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddChapter()}
                      placeholder="New chapter name"
                      className="text-xs bg-surface-2/60"
                    />
                    <button
                      type="button"
                      onClick={handleAddChapter}
                      className="w-full rounded-lg bg-teal-400 hover:bg-teal-300 text-teal-950 font-semibold text-xs py-2 px-3 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                    >
                      Add chapter
                    </button>
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* ========================================================================= */}
          {/* 3. Main Area: Sources Card + Questions Card (matching image.png) */}
          {/* ========================================================================= */}
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "content_bank" ? (
              <motion.div
                key={`syllabus-content-${activeSubject?.id || "no-sub"}-${activeChapter?.id || "no-chap"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="w-full space-y-6"
              >
                {/* Full Width Quick Selector Bar when in Full Width Mode */}
                {isFullWidthMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-500/30 bg-teal-950/25 p-3.5 sm:px-5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                          Subject:
                        </span>
                        <select
                          value={activeSubject?.id || ""}
                          onChange={(e) => {
                            setSelectedSubjectId(e.target.value);
                            setSelectedChapterId(null);
                          }}
                          className="rounded-lg border border-border/80 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({chapters.filter((c) => c.subject_id === s.id).length} ch)
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-muted font-mono">/</span>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                          Chapter:
                        </span>
                        <select
                          value={activeChapter?.id || ""}
                          onChange={(e) => setSelectedChapterId(e.target.value)}
                          className="rounded-lg border border-border/80 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                        >
                          {subjectChapters.map((c, i) => (
                            <option key={c.id} value={c.id}>
                              {String(i + 1).padStart(2, "0")}. {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFullWidthMode(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface-2/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all cursor-pointer"
                      title="Show Subjects and Chapters Sidebars"
                    >
                      <Minimize2 className="size-3.5 text-teal-400" />
                      <span>Split View (Show Sidebars)</span>
                    </button>
                  </motion.div>
                )}

                {/* TOP CARD: Sources in {activeChapter} (Collapsible for maximum question space) */}
                <Panel className="border border-border/70 bg-surface/90">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-base font-bold text-foreground font-serif">Sources</h2>
                      {activeChapter && (
                        <span className="text-xs text-muted italic font-serif">
                          in {activeChapter.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-faint">
                        {chapterSources.length} {chapterSources.length === 1 ? "source" : "sources"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSourcesCollapsed(!isSourcesCollapsed)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-2/80 transition-colors cursor-pointer font-mono"
                        title={
                          isSourcesCollapsed
                            ? "Expand Sources panel"
                            : "Collapse Sources panel to focus on Questions"
                        }
                      >
                        <span>{isSourcesCollapsed ? "Expand Sources" : "Collapse"}</span>
                        {isSourcesCollapsed ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronUp className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {!isSourcesCollapsed && (
                    <>
                      {/* Sources List matching screenshot */}
                      <div className="mt-4 space-y-2.5">
                        {chapterSources.length === 0 ? (
                          <p className="py-2 text-xs text-muted">
                            No reference sources linked to this chapter yet. Add one below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <AnimatePresence>
                              {chapterSources.map((s) => (
                                <motion.div
                                  key={s.id}
                                  layout
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-2/40 p-3 text-xs transition-colors hover:border-border"
                                >
                                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                                    <span className="rounded bg-teal-950/70 border border-teal-800/60 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-teal-300">
                                      {s.kind || "BOOK"}
                                    </span>
                                    <span className="font-semibold text-foreground text-sm truncate">
                                      {s.title}
                                    </span>
                                    {s.reference && (
                                      <span className="font-mono text-xs text-muted">
                                        {s.reference}
                                      </span>
                                    )}
                                    {(s.tags || []).map((t, tIdx) => (
                                      <span
                                        key={tIdx}
                                        className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-faint border border-border/40"
                                      >
                                        #{t.replace(/^#/, "")}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-muted shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditSource(s)}
                                      className="hover:text-teal-300 transition-colors cursor-pointer"
                                    >
                                      edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => promptDeleteItem("sources", s.id, s.title)}
                                      className="hover:text-rose transition-colors cursor-pointer"
                                    >
                                      delete
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>

                      {/* Add / Edit Source Form matching 2x2 grid from screenshot */}
                      <form
                        onSubmit={handleSaveSource}
                        className="mt-5 pt-4 border-t border-border/60 space-y-3.5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Title">
                            <Input
                              value={sourceTitle}
                              onChange={(e) => setSourceTitle(e.target.value)}
                              placeholder="Chapter 4 — Kinematics"
                              className="text-xs bg-surface-2/60"
                              required
                            />
                          </Field>

                          <Field label="Kind">
                            <Input
                              value={sourceKind}
                              onChange={(e) => setSourceKind(e.target.value)}
                              placeholder="book"
                              className="text-xs bg-surface-2/60"
                            />
                          </Field>

                          <Field label="Reference">
                            <Input
                              value={sourceReference}
                              onChange={(e) => setSourceReference(e.target.value)}
                              placeholder="pp. 88–120"
                              className="text-xs bg-surface-2/60"
                            />
                          </Field>

                          <Field label="Tags, comma separated">
                            <Input
                              value={sourceTags}
                              onChange={(e) => setSourceTags(e.target.value)}
                              placeholder="motion, graphs"
                              className="text-xs font-mono bg-surface-2/60"
                            />
                          </Field>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            className="rounded-lg bg-teal-400 hover:bg-teal-300 text-teal-950 font-semibold text-xs py-2 px-4 shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            {editingSourceId ? "Update source" : "Add source"}
                          </button>
                          {editingSourceId && (
                            <Btn
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEditSource}
                              className="text-xs"
                            >
                              Cancel
                            </Btn>
                          )}
                        </div>
                      </form>
                    </>
                  )}
                </Panel>

                {/* BOTTOM CARD: Questions {chapterMcqs.length} */}
                <Panel className="border border-border/70 bg-surface/90 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-foreground font-serif">Questions</h2>
                      <span className="rounded-full bg-teal-400/10 border border-teal-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-300">
                        {filteredChapterMcqs.length}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Full Width Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setIsFullWidthMode(!isFullWidthMode)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface-2/80 text-foreground font-medium text-xs px-2.5 py-1.5 transition-all cursor-pointer"
                        title={
                          isFullWidthMode
                            ? "Return to 3-column split view"
                            : "Expand question layout to cover entire page"
                        }
                      >
                        {isFullWidthMode ? (
                          <>
                            <Minimize2 className="size-3.5 text-teal-400" />
                            <span className="hidden sm:inline">Split View</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="size-3.5 text-teal-400" />
                            <span className="hidden sm:inline">Full Width</span>
                          </>
                        )}
                      </button>

                      {/* Grid vs List Layout Switcher */}
                      <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setMcqGridLayout("grid")}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            mcqGridLayout === "grid"
                              ? "bg-teal-400 text-teal-950 font-semibold shadow-xs"
                              : "text-muted hover:text-foreground"
                          }`}
                          title="Card Grid Layout"
                          aria-label="Card Grid Layout"
                        >
                          <LayoutGrid className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMcqGridLayout("list")}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            mcqGridLayout === "list"
                              ? "bg-teal-400 text-teal-950 font-semibold shadow-xs"
                              : "text-muted hover:text-foreground"
                          }`}
                          title="Full-Width Single Column List"
                          aria-label="Full-Width Single Column List"
                        >
                          <List className="size-3.5" />
                        </button>
                      </div>

                      {/* Compact vs Formatted Switcher */}
                      <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => setMcqViewMode("compact")}
                          className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                            mcqViewMode === "compact"
                              ? "bg-teal-400 text-teal-950 font-semibold"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Compact
                        </button>
                        <button
                          type="button"
                          onClick={() => setMcqViewMode("formatted")}
                          className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                            mcqViewMode === "formatted"
                              ? "bg-teal-400 text-teal-950 font-semibold"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Clean & Formatted
                        </button>
                      </div>

                      {/* Add MCQ Button */}
                      <button
                        type="button"
                        onClick={handleOpenAddMcq}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-400/10 hover:bg-teal-400/20 text-teal-300 font-semibold text-xs px-3 py-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="size-3.5 text-teal-400" />
                        Add MCQ
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters Bar for MCQs */}
                  <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-surface-2/30 p-2.5 border border-border/50">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                      <input
                        type="text"
                        value={mcqSearchQuery}
                        onChange={(e) => setMcqSearchQuery(e.target.value)}
                        placeholder="Search question, options, or tags..."
                        className="w-full rounded-lg border border-border/60 bg-surface-2/50 py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-faint focus:border-teal-400 focus:outline-none"
                      />
                      {mcqSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMcqSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-foreground text-xs p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <select
                      value={mcqDifficultyFilter}
                      onChange={(e) => setMcqDifficultyFilter(e.target.value as never)}
                      className="rounded-lg border border-border/60 bg-surface-2/50 px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>

                    <select
                      value={mcqSourceFilter}
                      onChange={(e) => setMcqSourceFilter(e.target.value)}
                      className="rounded-lg border border-border/60 bg-surface-2/50 px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Sources</option>
                      {chapterSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>

                    <select
                      value={mcqStatusFilter}
                      onChange={(e) => setMcqStatusFilter(e.target.value)}
                      className="rounded-lg border border-border/60 bg-surface-2/50 px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Status</option>
                      <option value="approved">Approved</option>
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  {/* MCQs Clean Card-Based Grid with Framer Motion (Always covers entire width) */}
                  <div className="mt-2">
                    <AnimatePresence mode="popLayout">
                      {filteredChapterMcqs.length === 0 ? (
                        <motion.div
                          key="empty-mcqs-state"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                          className="py-12 text-center space-y-3.5 rounded-2xl border border-dashed border-border/70 bg-surface-2/20 p-6"
                        >
                          <div className="size-12 rounded-full bg-teal-400/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
                            <BookOpen className="size-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              No questions found
                            </p>
                            <p className="text-xs text-muted max-w-sm mx-auto">
                              No MCQs match your filter criteria. Try clearing search or add a new
                              question.
                            </p>
                          </div>
                          <Btn
                            size="sm"
                            variant="outline"
                            onClick={handleOpenAddMcq}
                            className="gap-1.5 text-xs"
                          >
                            <Plus className="size-3.5 text-teal-400" /> Add First MCQ
                          </Btn>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`${activeChapter?.id}-${mcqGridLayout}-${mcqViewMode}-${isFullWidthMode}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.22 }}
                          className={
                            mcqGridLayout === "grid" && filteredChapterMcqs.length > 1
                              ? isFullWidthMode
                                ? "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-stretch w-full"
                                : "grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch w-full"
                              : "grid grid-cols-1 gap-4 w-full"
                          }
                        >
                          {filteredChapterMcqs.map((m, idx) => (
                            <McqCard
                              key={m.id}
                              index={idx + 1}
                              mcq={m}
                              sources={sources}
                              viewMode={mcqViewMode}
                              isExpanded={!!expandedMcqIds[m.id]}
                              onToggleExpand={() => toggleExpandMcq(m.id)}
                              onEdit={() => handleOpenEditMcq(m)}
                              onDelete={() =>
                                promptDeleteItem("mcqs", m.id, m.question.slice(0, 45) + "...")
                              }
                              chapterId={activeChapter?.id}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Panel>
              </motion.div>
            ) : (
              /* ========================================================================= */
              /* 4. Alternative Tab: Topics & SM-2 Tracker */
              /* ========================================================================= */
              <motion.div
                key={`syllabus-topics-${activeSubject?.id || "no-sub"}-${activeChapter?.id || "no-chap"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Panel className="border border-border/70 bg-surface/90">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <Target className="size-4 text-teal-400" />
                        Topics & Concepts Tracker
                      </h2>
                      <p className="text-xs text-muted mt-0.5">
                        {activeChapter
                          ? `${activeSubject?.name} · ${activeChapter.name} (${chapterTopics.length} topics)`
                          : "Select a chapter to track learning state & spaced-repetition due dates"}
                      </p>
                    </div>
                    {activeChapter && (
                      <div className="flex items-center gap-2">
                        <Btn
                          size="sm"
                          variant="outline"
                          onClick={handleAutoMigrateTags}
                          className="gap-1.5 text-xs cursor-pointer"
                        >
                          <Sparkles className="size-3.5 text-amber" /> Auto-Promote Tags
                        </Btn>
                      </div>
                    )}
                  </div>

                  {!activeChapter ? (
                    <div className="py-8">
                      <Empty
                        title="No Chapter Selected"
                        body="Pick a subject and chapter to explore and manage individual syllabus topics."
                      />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {/* Topic Filter Controls Bar */}
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/40 p-2.5 border border-border">
                        <div className="relative flex-1 min-w-[140px]">
                          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                          <Input
                            value={topicSearchQuery}
                            onChange={(e) => setTopicSearchQuery(e.target.value)}
                            placeholder="Filter topics..."
                            className="pl-8 text-xs h-8"
                          />
                        </div>

                        <Select
                          value={topicStatusFilter}
                          onChange={(e) => setTopicStatusFilter(e.target.value as never)}
                          className="text-xs h-8 w-32"
                        >
                          <option value="all">All Statuses</option>
                          <option value="not_studied">Not Studied</option>
                          <option value="studying">Studying</option>
                          <option value="done">Done (Mastered)</option>
                        </Select>

                        <Select
                          value={topicConfidenceFilter}
                          onChange={(e) => setTopicConfidenceFilter(e.target.value as never)}
                          className="text-xs h-8 w-32"
                        >
                          <option value="all">All Confidence</option>
                          <option value="low">Low Confidence</option>
                          <option value="medium">Med Confidence</option>
                          <option value="high">High Confidence</option>
                        </Select>

                        <Select
                          value={topicPriorityFilter}
                          onChange={(e) => setTopicPriorityFilter(e.target.value as never)}
                          className="text-xs h-8 w-28"
                        >
                          <option value="all">All Priority</option>
                          <option value="high">High Priority</option>
                          <option value="med">Med Priority</option>
                          <option value="low">Low Priority</option>
                        </Select>

                        <Select
                          value={topicSortBy}
                          onChange={(e) => setTopicSortBy(e.target.value as never)}
                          className="text-xs h-8 w-32 font-mono"
                        >
                          <option value="priority">Sort: Priority</option>
                          <option value="due">Sort: Due Date</option>
                          <option value="name">Sort: Name</option>
                        </Select>
                      </div>

                      {/* Add Topic Input Form */}
                      <div className="flex gap-2">
                        <Input
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
                          placeholder="Add individual topic or concept (e.g., 'Projectile Motion')..."
                          className="text-xs"
                        />
                        <Btn
                          size="sm"
                          onClick={handleAddTopic}
                          className="shrink-0 gap-1.5 cursor-pointer"
                        >
                          <Plus className="size-3" /> Add Topic
                        </Btn>
                      </div>

                      {/* Topic Items List */}
                      {filteredTopics.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted">
                          No topics match your current filter criteria.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {filteredTopics.map((t) => {
                            const statusStr =
                              t.status ||
                              (t.completion === "completed"
                                ? "done"
                                : t.completion === "in_progress"
                                  ? "studying"
                                  : "not_studied");
                            const confStr =
                              t.confidence === "medium" ? "med" : t.confidence || "med";
                            const prioStr = (t.priority || "med").toUpperCase();
                            const dueDate = t.due_at || t.due_review_at;
                            const sm2Info = formatSM2DueDate(dueDate);

                            return (
                              <motion.li
                                key={t.id}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border border-border bg-surface-2/30 p-3.5 transition-colors hover:border-border-2"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateTopicStatus(
                                          t,
                                          statusStr === "done"
                                            ? "not_studied"
                                            : statusStr === "studying"
                                              ? "done"
                                              : "studying",
                                        )
                                      }
                                      className="mt-0.5 shrink-0 text-muted hover:text-accent transition-colors cursor-pointer"
                                      title="Cycle topic progress"
                                    >
                                      {statusStr === "done" ? (
                                        <CheckCircle2 className="size-4 text-emerald-400" />
                                      ) : statusStr === "studying" ? (
                                        <Clock className="size-4 text-amber" />
                                      ) : (
                                        <Circle className="size-4 text-faint" />
                                      )}
                                    </button>

                                    <div className="space-y-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">
                                          {t.name}
                                        </span>
                                        <Badge
                                          variant={
                                            prioStr === "HIGH"
                                              ? "destructive"
                                              : prioStr === "MED"
                                                ? "secondary"
                                                : "outline"
                                          }
                                          className="text-[9px] uppercase tracking-wider font-mono h-4 px-1.5"
                                        >
                                          {prioStr}
                                        </Badge>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted">
                                        <span
                                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${sm2Info.colorClass}`}
                                        >
                                          {sm2Info.label}
                                        </span>
                                        <span>·</span>
                                        <span>
                                          Interval: {t.interval_days ?? 1}d (EF:{" "}
                                          {(t.ease_factor ?? 2.5).toFixed(1)})
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5 font-mono text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => updateTopicConfidence(t, "low")}
                                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                          confStr === "low"
                                            ? "bg-rose/20 text-rose font-semibold"
                                            : "text-faint hover:text-foreground"
                                        }`}
                                      >
                                        Low
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateTopicConfidence(t, "med")}
                                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                          confStr === "med"
                                            ? "bg-amber/20 text-amber font-semibold"
                                            : "text-faint hover:text-foreground"
                                        }`}
                                      >
                                        Med
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateTopicConfidence(t, "high")}
                                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                          confStr === "high"
                                            ? "bg-accent/20 text-accent font-semibold"
                                            : "text-faint hover:text-foreground"
                                        }`}
                                      >
                                        High
                                      </button>
                                    </div>

                                    <Link to="/practice" search={{ topicId: t.id }}>
                                      <Btn
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2.5 text-[11px] font-mono gap-1 text-accent border-accent/30 hover:bg-accent/10 cursor-pointer"
                                      >
                                        <Play className="size-3" /> Drill
                                      </Btn>
                                    </Link>

                                    <button
                                      type="button"
                                      onClick={() => promptDeleteItem("topics", t.id, t.name)}
                                      className="rounded p-1 text-faint transition-colors hover:text-rose cursor-pointer"
                                      title={`Delete topic "${t.name}"`}
                                      aria-label={`Delete topic "${t.name}"`}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </motion.li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal: Add or Edit MCQ */}
        <McqModal
          isOpen={isMcqModalOpen}
          onClose={() => {
            setIsMcqModalOpen(false);
            setEditingMcq(null);
          }}
          onSave={handleSaveMcq}
          initialMcq={editingMcq}
          sources={chapterSources}
          chapterName={activeChapter?.name}
        />

        {/* Modal: AI Bulk Syllabus Importer */}
        <AnimatePresence>
          {importModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5"
              >
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-teal-400" />
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        AI Bulk Syllabus Importer
                      </h2>
                      <p className="text-xs text-muted">
                        Extract structured Subjects, Chapters & Topics from unformatted course
                        outlines
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImportModalOpen(false);
                      setExtractedPreview(null);
                    }}
                    className="rounded-md p-1 text-muted hover:text-foreground cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {!extractedPreview ? (
                  <div className="space-y-4">
                    <Field label="Paste syllabus text, course outline, or curriculum table of contents:">
                      <Textarea
                        rows={8}
                        value={importRawText}
                        onChange={(e) => setImportRawText(e.target.value)}
                        placeholder="Example:&#10;Physics:&#10;1. Mechanics&#10; - Newton's Laws&#10; - Projectile Motion&#10;2. Thermodynamics&#10; - Heat Engines&#10; - Entropy"
                        className="font-mono text-xs"
                      />
                    </Field>

                    <div className="flex justify-end gap-2">
                      <Btn variant="outline" onClick={() => setImportModalOpen(false)}>
                        Cancel
                      </Btn>
                      <Btn
                        onClick={handleExtractSyllabus}
                        disabled={isExtracting}
                        className="gap-2 bg-teal-400 hover:bg-teal-300 text-teal-950 font-semibold"
                      >
                        <Sparkles className="size-3.5" />
                        {isExtracting ? "Analyzing Syllabus..." : "Extract Structure with AI"}
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3">
                      <p className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                        <Sparkles className="size-3.5" /> AI Extracted{" "}
                        {extractedPreview.subjects.length} Subjects
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Review and verify the extracted hierarchy before saving to your syllabus.
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-3 rounded-xl border border-border bg-surface-2/40 p-3">
                      {extractedPreview.subjects.map((sub, sIdx) => (
                        <div
                          key={sIdx}
                          className="space-y-1.5 border-b border-border/50 pb-2 last:border-none"
                        >
                          <div className="flex items-center gap-2 font-medium text-xs text-foreground">
                            <span className="size-2 rounded-full bg-teal-400" />
                            <span>{sub.name}</span>
                            <span className="font-mono text-[10px] text-faint">
                              ({sub.chapters.length} chapters)
                            </span>
                          </div>
                          <ul className="pl-4 space-y-1 text-[11px] text-muted">
                            {sub.chapters.map((ch, cIdx) => (
                              <li key={cIdx}>
                                <strong>{ch.name}:</strong>{" "}
                                {ch.topics.join(", ") || "General topics"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        type="button"
                        onClick={() => setExtractedPreview(null)}
                        className="text-xs text-muted hover:text-foreground font-mono cursor-pointer"
                      >
                        ← Back to edit text
                      </button>
                      <div className="flex gap-2">
                        <Btn variant="outline" onClick={() => setImportModalOpen(false)}>
                          Cancel
                        </Btn>
                        <Btn
                          onClick={handleCommitExtractedSyllabus}
                          className="gap-1.5 bg-teal-400 hover:bg-teal-300 text-teal-950 font-semibold"
                        >
                          <CheckCircle2 className="size-3.5" /> Approve & Import to Syllabus
                        </Btn>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Delete Confirmation Dialog */}
        <AnimatePresence>
          {deleteConfirmTarget && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose/15 text-rose">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h3
                      id="delete-dialog-title"
                      className="text-base font-semibold text-foreground"
                    >
                      Delete{" "}
                      {deleteConfirmTarget.table === "subjects"
                        ? "Subject"
                        : deleteConfirmTarget.table === "chapters"
                          ? "Chapter"
                          : deleteConfirmTarget.table === "topics"
                            ? "Topic"
                            : deleteConfirmTarget.table === "sources"
                              ? "Reference Source"
                              : "MCQ"}
                      ?
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Are you sure you want to delete{" "}
                      <strong className="text-foreground">"{deleteConfirmTarget.name}"</strong>?
                      {deleteConfirmTarget.table === "subjects"
                        ? " All associated chapters, topics, sources, and questions in this subject will also be permanently deleted."
                        : deleteConfirmTarget.table === "chapters"
                          ? " All associated topics, sources, and questions in this chapter will also be permanently deleted."
                          : deleteConfirmTarget.table === "topics"
                            ? " This topic will be permanently removed from your syllabus tracker."
                            : deleteConfirmTarget.table === "sources"
                              ? " This reference source will be removed from this chapter."
                              : " This question will be permanently removed from your question bank."}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Btn
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteConfirmTarget(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Btn>
                  <button
                    type="button"
                    onClick={executeConfirmedDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose/90 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    {isDeleting ? "Deleting..." : "Delete Permanently"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
