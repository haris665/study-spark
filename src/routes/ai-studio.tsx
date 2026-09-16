import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  FileText,
  Image as ImageIcon,
  Plus,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Edit3,
  Check,
  X,
  Clock,
  Layers,
  FileSpreadsheet,
  Zap,
  Cloud,
  UploadCloud,
  ChevronRight,
  HelpCircle,
  FileCheck,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery, chaptersQuery, mcqsQuery, type Mcq } from "@/lib/queries";
import { generateMcqs } from "@/lib/ai.functions";

export const Route = createFileRoute("/ai-studio")({
  head: () => ({
    meta: [
      { title: "AI Question Studio — Study Spark" },
      {
        name: "description",
        content:
          "Extract MCQs from PDFs and images, or generate similar practice questions directly into your chapters.",
      },
      { property: "og:title", content: "AI Question Studio — Study Spark" },
      {
        property: "og:description",
        content:
          "Extract MCQs from PDFs and images, or generate similar practice questions directly into your chapters.",
      },
    ],
  }),
  component: AiStudio,
});

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });

interface AiSession {
  id: string;
  name: string;
  createdAt: string;
  docsCount: number;
  extractedCount: number;
  generatedCount: number;
}

const DEFAULT_SESSIONS: AiSession[] = [
  {
    id: "sess-1",
    name: "AI session 1",
    createdAt: "11:34 AM",
    docsCount: 1,
    extractedCount: 15,
    generatedCount: 9,
  },
];

const SAMPLE_TEXT_EXTRACT = `1. This is a strong retreat for a truly happy man according to the poem "The Character of a Happy Life":
A) Home
B) Conscience
C) Wealth
D) Friends
Answer: B
Explanation: In the poem "The Character of a Happy Life" by Sir Henry Wotton, the poet suggests that a truly happy man's "strong retreat" or inner protection is his own conscience.

2. In cellular respiration, which metabolic stage produces the highest net yield of ATP molecules per glucose molecule?
A) Glycolysis
B) Krebs Cycle (Citric Acid Cycle)
C) Oxidative Phosphorylation (Electron Transport Chain)
D) Fermentation
Answer: C
Explanation: Oxidative phosphorylation produces approximately 26 to 28 ATP molecules through the electrochemical proton gradient across the inner mitochondrial membrane.

3. Two charges +q and -q are separated by distance d in vacuum. What is the electrostatic potential at the midpoint between the two charges?
A) Zero
B) kq / d
C) 2kq / d
D) -kq / d
Answer: A
Explanation: Electrostatic potential is a scalar quantity. At the exact midpoint, V = kq/(d/2) + k(-q)/(d/2) = 0.`;

export function AiStudio() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Mode: Extract from files vs Generate from syllabus / similar
  const [studioMode, setStudioMode] = useState<"extract" | "generate">("extract");

  // Sessions
  const [sessions, setSessions] = useState<AiSession[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("study_spark_ai_sessions");
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_SESSIONS;
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || "sess-1");

  // Extract Mode Inputs
  const [extractKind, setExtractKind] = useState<"pdf" | "image" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [extractText, setExtractText] = useState("");
  const [extractChapterId, setExtractChapterId] = useState("");
  const [extractCount, setExtractCount] = useState(20);
  const [extractAll, setExtractAll] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate / Similar Mode Inputs
  const [genSubjectId, setGenSubjectId] = useState("");
  const [genChapterId, setGenChapterId] = useState("");
  const [referenceMcqId, setReferenceMcqId] = useState<string>("");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [genCount, setGenCount] = useState(8);
  const [genDifficulty, setGenDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");

  // Queries
  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: allMcqs = [] } = useQuery({ ...mcqsQuery(), enabled: !!user });

  // Filtered chapters for generate mode
  const availableGenChapters = useMemo(() => {
    if (!genSubjectId) return chapters;
    return chapters.filter((c) => c.subject_id === genSubjectId);
  }, [chapters, genSubjectId]);

  // Existing MCQs in the selected chapter for "Make Similar"
  const chapterMcqs = useMemo(() => {
    if (!genChapterId) return allMcqs.filter((m) => m.status === "approved");
    return allMcqs.filter((m) => m.chapter_id === genChapterId && m.status === "approved");
  }, [allMcqs, genChapterId]);

  const selectedReferenceMcq = useMemo(() => {
    if (!referenceMcqId) return null;
    return allMcqs.find((m) => m.id === referenceMcqId) || null;
  }, [allMcqs, referenceMcqId]);

  // Pending Review items
  const pendingMcqs = useMemo(() => {
    return allMcqs.filter((m) => m.status === "pending");
  }, [allMcqs]);

  // Active Session
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const updateSessionsStorage = (updated: AiSession[]) => {
    setSessions(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("study_spark_ai_sessions", JSON.stringify(updated));
    }
  };

  const handleCreateNewSession = () => {
    const newSess: AiSession = {
      id: "sess-" + Date.now().toString(36),
      name: `AI session ${sessions.length + 1}`,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      docsCount: 0,
      extractedCount: 0,
      generatedCount: 0,
    };
    const updated = [newSess, ...sessions];
    updateSessionsStorage(updated);
    setActiveSessionId(newSess.id);
    toast.success(`Created "${newSess.name}"`);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      toast.error("You must have at least one session.");
      return;
    }
    const updated = sessions.filter((s) => s.id !== id);
    updateSessionsStorage(updated);
    if (activeSessionId === id) {
      setActiveSessionId(updated[0]?.id || "sess-1");
    }
    toast.info("Session removed.");
  };

  // Extract Action
  const handleExtract = async () => {
    if (!user) {
      toast.error("Please log in to extract questions.");
      return;
    }

    if (extractKind === "text" && extractText.trim().length < 15) {
      toast.error("Please paste question text or click 'Load Sample Exam MCQs'.");
      return;
    }

    if (extractKind !== "text" && !file) {
      toast.error(
        `Please upload a ${extractKind === "pdf" ? "PDF document" : "image"} file first.`,
      );
      return;
    }

    if (file && file.size > 18 * 1024 * 1024) {
      toast.error(
        "This file is too large for a reliable inline OCR scan. Please upload a PDF or image under 18 MB.",
      );
      return;
    }

    setBusy(true);
    setBusyMessage(
      extractKind === "pdf"
        ? extractAll
          ? "Performing multi-page scan to extract ALL MCQs in PDF..."
          : `Extracting up to ${extractCount} MCQs from PDF...`
        : extractKind === "image"
          ? "Analyzing image and extracting questions..."
          : "Parsing and solving questions from text...",
    );

    try {
      const fileDataUrl = file ? await readAsDataUrl(file) : undefined;
      const targetChapter = chapters.find((c) => c.id === extractChapterId);
      const targetSubject = subjects.find((s) => s.id === targetChapter?.subject_id);

      const isPdfAll = extractKind === "pdf" && extractAll;

      const result = await generateMcqs({
        data: {
          mode: "extract",
          kind: extractKind,
          extractAll: isPdfAll,
          count: isPdfAll ? 100 : extractCount,
          ...(extractText.trim() ? { text: extractText.trim() } : {}),
          ...(fileDataUrl ? { fileDataUrl } : {}),
          ...(file ? { fileName: file.name } : {}),
          ...(targetChapter ? { chapterName: targetChapter.name } : {}),
          ...(targetSubject ? { subjectName: targetSubject.name } : {}),
        },
      });

      if (!result.mcqs || result.mcqs.length === 0) {
        toast.info("No MCQs could be extracted. Please check the document clarity.");
        return;
      }

      const cleanMcqs = result.mcqs.filter(
        (m) => m.options.length === 4 && m.correct_index >= 0 && m.correct_index <= 3,
      );

      if (cleanMcqs.length === 0) {
        toast.info("The scan was read, but no complete four-option MCQs were found.");
        return;
      }

      const rows = cleanMcqs.map((m) => ({
        user_id: user.id,
        chapter_id: extractChapterId || null,
        subject_id: targetChapter?.subject_id || null,
        question: m.question,
        options: m.options,
        correct_index: m.correct_index,
        explanation: m.explanation || null,
        difficulty: m.difficulty,
        tags: m.tags && m.tags.length > 0 ? m.tags : ["extracted", "exam-prep"],
        status: "pending",
        origin: "extracted",
      }));

      const { error } = await supabase.from("mcqs").insert(rows);
      if (error) throw new Error(error.message);

      // Update session metrics
      if (activeSession) {
        const updated = sessions.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                docsCount: s.docsCount + (file ? 1 : 0),
                extractedCount: s.extractedCount + rows.length,
              }
            : s,
        );
        updateSessionsStorage(updated);
      }

      qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success(`Extracted and corrected ${rows.length} MCQ(s). Review them below.`);
      setFile(null);
      setExtractText("");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "AI extraction failed. Check that Gemini is configured and try again.",
      );
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  };

  // Quick helper to seed demo pending review item if empty
  const handleLoadDemoSample = async () => {
    if (!user) return;
    try {
      const demoRows = [
        {
          user_id: user.id,
          question:
            'This is a strong retreat for a truly happy man according to the poem "The Character of a Happy Life":',
          options: ["Home", "Conscience", "Wealth", "Friends"],
          correct_index: 1,
          explanation:
            'In the poem "The Character of a Happy Life" by Sir Henry Wotton, the poet suggests that a truly happy man\'s "strong retreat" or inner protection is his own conscience.',
          difficulty: "medium",
          tags: ["Poetry", "Literature"],
          status: "pending",
          origin: "extracted",
        },
        {
          user_id: user.id,
          question:
            "Which of the following cellular organelles is enclosed by a double membrane and possesses its own circular DNA?",
          options: ["Golgi apparatus", "Mitochondria", "Lysosome", "Ribosome"],
          correct_index: 1,
          explanation:
            "Mitochondria and chloroplasts are semi-autonomous organelles bounded by two membranes and containing circular prokaryote-like DNA.",
          difficulty: "easy",
          tags: ["Cell Biology", "Organelles"],
          status: "pending",
          origin: "extracted",
        },
      ];
      await supabase.from("mcqs").insert(demoRows);
      qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success("Loaded sample extracted MCQs for review!");
    } catch (err) {
      console.warn(err);
    }
  };

  // Generate / Similar Action
  const handleGenerate = async () => {
    if (!user) {
      toast.error("Please log in to generate questions.");
      return;
    }

    setBusy(true);
    setBusyMessage(
      selectedReferenceMcq
        ? "Creating parallel variations from reference question..."
        : `Crafting ${genCount} exam-ready questions from chapter syllabus...`,
    );

    try {
      const targetChapter = chapters.find((c) => c.id === genChapterId);
      const targetSubject = subjects.find(
        (s) => s.id === (genSubjectId || targetChapter?.subject_id),
      );

      const isSimilarMode = !!selectedReferenceMcq;

      const result = await generateMcqs({
        data: {
          mode: isSimilarMode ? "similar" : "generate",
          kind: "text",
          count: genCount,
          difficulty: genDifficulty,
          topic: topicPrompt.trim() || undefined,
          chapterName: targetChapter?.name,
          subjectName: targetSubject?.name,
          ...(isSimilarMode && selectedReferenceMcq
            ? {
                referenceQuestion: {
                  question: selectedReferenceMcq.question,
                  options: selectedReferenceMcq.options,
                  correct_index: selectedReferenceMcq.correct_index,
                  explanation: selectedReferenceMcq.explanation || undefined,
                },
              }
            : {}),
        },
      });

      if (!result.mcqs || result.mcqs.length === 0) {
        toast.info("Could not generate questions. Please try altering the topic.");
        return;
      }

      const cleanMcqs = result.mcqs.filter(
        (m) => m.options.length === 4 && m.correct_index >= 0 && m.correct_index <= 3,
      );

      if (cleanMcqs.length === 0) {
        toast.info("The AI response did not contain complete four-option MCQs.");
        return;
      }

      const rows = cleanMcqs.map((m) => ({
        user_id: user.id,
        chapter_id: genChapterId || null,
        subject_id: genSubjectId || targetChapter?.subject_id || null,
        question: m.question,
        options: m.options,
        correct_index: m.correct_index,
        explanation: m.explanation || null,
        difficulty: m.difficulty,
        tags: m.tags && m.tags.length > 0 ? m.tags : [topicPrompt || "syllabus-drill"],
        status: "pending",
        origin: isSimilarMode ? "similar_ai" : "ai_generated",
      }));

      const { error } = await supabase.from("mcqs").insert(rows);
      if (error) throw new Error(error.message);

      // Update session metrics
      if (activeSession) {
        const updated = sessions.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                generatedCount: s.generatedCount + rows.length,
              }
            : s,
        );
        updateSessionsStorage(updated);
      }

      qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success(
        `Generated ${rows.length} ${isSimilarMode ? "similar" : "new"} question(s)! Review them below.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "AI generation failed. Check that Gemini is configured and try again.",
      );
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  };

  // Review Decisions
  const decide = async (id: string, status: "approved" | "rejected", targetChapterId?: string) => {
    const subjectId = targetChapterId
      ? (chapters.find((c) => c.id === targetChapterId)?.subject_id ?? null)
      : null;
    const patch = targetChapterId
      ? { status, chapter_id: targetChapterId, subject_id: subjectId }
      : { status };

    const { error } = await supabase.from("mcqs").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["mcqs"] });
    toast.success(
      status === "approved" ? "Question approved & added to chapter!" : "Question rejected.",
    );
  };

  const handleApproveAll = async () => {
    if (pendingMcqs.length === 0) return;
    try {
      const updates = pendingMcqs.map((m) =>
        supabase.from("mcqs").update({ status: "approved" }).eq("id", m.id),
      );
      await Promise.all(updates);
      qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success(`Approved all ${pendingMcqs.length} questions into question bank!`);
    } catch {
      toast.error("Failed to approve all questions.");
    }
  };

  const handleRejectAll = async () => {
    if (pendingMcqs.length === 0) return;
    try {
      const updates = pendingMcqs.map((m) =>
        supabase.from("mcqs").update({ status: "rejected" }).eq("id", m.id),
      );
      await Promise.all(updates);
      qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.info("Cleared pending queue.");
    } catch {
      toast.error("Failed to clear queue.");
    }
  };

  // Trigger "Make Similar" from an existing review card
  const handleMakeSimilarFromCard = (mcq: Mcq) => {
    setStudioMode("generate");
    if (mcq.subject_id) setGenSubjectId(mcq.subject_id);
    if (mcq.chapter_id) setGenChapterId(mcq.chapter_id);
    setReferenceMcqId(mcq.id);
    if (mcq.tags && mcq.tags.length > 0) {
      setTopicPrompt(mcq.tags.join(", "));
    }
    toast.info(
      `Selected "${mcq.question.slice(0, 40)}..." as reference. Ready to generate similar questions.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppShell
      title="AI question studio"
      subtitle="Extract from documents or generate similar questions directly into your chapters"
      actions={
        <div className="flex items-center gap-2">
          {pendingMcqs.length > 0 ? (
            <span className="rounded-full bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-semibold text-emerald-400">
              {pendingMcqs.length} pending review
            </span>
          ) : (
            <button
              onClick={handleLoadDemoSample}
              className="rounded-full bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-medium text-emerald-400 hover:bg-emerald-900/50 transition-colors"
              title="Load demo questions for review"
            >
              + Demo Review MCQs
            </button>
          )}
          <span className="rounded-full bg-slate-900/90 border border-slate-700/60 px-3 py-1 font-mono text-xs text-slate-300">
            Cloud synced
          </span>
        </div>
      }
    >
      <div className="ai-studio grid gap-6 lg:grid-cols-[270px_1fr]">
        {/* ================= LEFT COLUMN: SESSIONS & TIPS ================= */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-[#131924] p-4 shadow-sm">
            <div className="flex items-center justify-between pb-1">
              <span className="font-mono text-xs font-semibold text-slate-400">AI sessions</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCreateNewSession}
                id="btn-new-ai-session"
                className="flex items-center gap-1 rounded-md border border-slate-700/70 bg-[#1a2333] px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>+ New</span>
              </motion.button>
            </div>

            <div className="mt-3 space-y-2">
              <AnimatePresence>
                {sessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  return (
                    <motion.div
                      key={sess.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setActiveSessionId(sess.id)}
                      className={`group relative cursor-pointer rounded-xl p-3 border transition-all ${
                        isActive
                          ? "border-[#dca54c] bg-[#1a2233]/90 shadow-sm ring-1 ring-[#dca54c]/30"
                          : "border-slate-800 bg-[#161f2e]/60 hover:bg-[#182233] hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-100">{sess.name}</span>
                        {isActive ? (
                          <span className="rounded-full bg-emerald-900/60 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteSession(sess.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-xs p-0.5 transition-opacity"
                            title="Delete session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span
                          title="Documents processed"
                          className="flex items-center gap-1 text-slate-300"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          {sess.docsCount}
                        </span>
                        <span
                          title="Extracted MCQs"
                          className="flex items-center gap-1 text-amber-400"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          {sess.extractedCount}
                        </span>
                        <span
                          title="Generated MCQs"
                          className="flex items-center gap-1 text-emerald-400"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {sess.generatedCount}
                        </span>
                        <span className="ml-auto text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {sess.createdAt}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Smart study tip box */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#131924] p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-[#dca54c]">
              <Sparkles className="h-4 w-4 text-[#dca54c]" />
              <span>Smart study tip</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              Use <strong className="text-white font-semibold">Extract</strong> to digitize
              questions from exam papers or textbook photos. Use{" "}
              <strong className="text-white font-semibold">Generate similar</strong> to test if
              you've truly mastered a concept through parallel variations.
            </p>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: MAIN WORK AREA ================= */}
        <div className="space-y-6">
          {/* Top Mode Switcher Tabs */}
          <div className="rounded-2xl border border-slate-800 bg-[#131924] p-1.5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                id="tab-extract-mode"
                onClick={() => setStudioMode("extract")}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  studioMode === "extract"
                    ? "bg-[#dca54c] text-zinc-950 font-bold shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-[#1a2333]"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Extract from PDF / images</span>
              </button>

              <button
                id="tab-generate-mode"
                onClick={() => setStudioMode("generate")}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  studioMode === "generate"
                    ? "bg-[#dca54c] text-zinc-950 font-bold shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-[#1a2333]"
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Generate similar MCQs</span>
              </button>
            </div>
          </div>

          {/* Mode Card Content */}
          <AnimatePresence mode="wait">
            {studioMode === "extract" ? (
              /* =================== EXTRACT MODE =================== */
              <motion.div
                key="tab-extract"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-slate-800/80 bg-[#131924] p-6 shadow-sm space-y-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white tracking-tight">
                      Extract existing MCQs
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Upload exam papers, PDF sheets, or test photos. The AI extracts all questions
                      with options and verified solutions.
                    </p>
                  </div>

                  {/* Source type pills */}
                  <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0f1520] p-1 text-xs">
                    <span className="text-[11px] text-slate-400 px-2 font-medium">Source type</span>
                    <button
                      onClick={() => {
                        setExtractKind("pdf");
                        setFile(null);
                      }}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        extractKind === "pdf"
                          ? "bg-[#1f293d] text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => {
                        setExtractKind("image");
                        setFile(null);
                      }}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        extractKind === "image"
                          ? "bg-[#1f293d] text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Image / photo
                    </button>
                    <button
                      onClick={() => {
                        setExtractKind("text");
                        setFile(null);
                      }}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        extractKind === "text"
                          ? "bg-[#1f293d] text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Pasted text
                    </button>
                  </div>
                </div>

                {/* Main input body based on extractKind */}
                {extractKind === "text" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">
                        Paste exam questions or notes
                      </label>
                      <button
                        onClick={() => setExtractText(SAMPLE_TEXT_EXTRACT)}
                        className="text-xs text-[#dca54c] hover:underline"
                      >
                        Insert sample MDCAT & Physics questions
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={extractText}
                      onChange={(e) => setExtractText(e.target.value)}
                      placeholder={`1. Which organelle produces ATP?\nA) Ribosome\nB) Mitochondria\nC) Nucleus\nD) Endoplasmic reticulum`}
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] p-3.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#dca54c] focus:outline-none font-mono leading-relaxed"
                    />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (e.dataTransfer.files?.[0]) {
                            setFile(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                          isDragging
                            ? "border-[#dca54c] bg-[#dca54c]/10"
                            : file
                              ? "border-emerald-500/50 bg-emerald-500/5"
                              : "border-slate-800 bg-[#161f2e]/40 hover:border-slate-700 hover:bg-[#161f2e]"
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a2333] text-slate-300 mb-2.5 border border-slate-700/60">
                          {file ? (
                            <FileCheck className="h-5 w-5 text-emerald-400" />
                          ) : extractKind === "pdf" ? (
                            <UploadCloud className="h-5 w-5 text-[#dca54c]" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-[#dca54c]" />
                          )}
                        </div>

                        <span className="text-sm font-semibold text-slate-100">
                          {file
                            ? file.name
                            : extractKind === "pdf"
                              ? "Click or drag & drop PDF file"
                              : "Click or drag & drop image file"}
                        </span>

                        <span className="mt-1 text-xs text-slate-400">
                          {file
                            ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready for multi-page scan`
                            : extractKind === "pdf"
                              ? "Upload question papers, question banks, or notes in PDF"
                              : "Upload screenshots, photos of test papers, or textbook pages"}
                        </span>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={extractKind === "pdf" ? "application/pdf" : "image/*"}
                          className="hidden"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </div>

                      {file && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                          className="absolute top-3 right-3 rounded-full bg-slate-800/80 p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          title="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Image thumbnail preview */}
                    {file && extractKind === "image" && (
                      <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2 flex items-start gap-3">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Preview"
                          className="h-24 w-24 object-cover rounded-lg border border-slate-700/60 shrink-0"
                        />
                        <div className="flex flex-col gap-1 pt-1 text-xs text-slate-300">
                          <span className="font-semibold text-emerald-400">
                            📷 Image ready for OCR
                          </span>
                          <span className="text-slate-400">{file.name}</span>
                          <span className="text-slate-500">
                            {(file.size / 1024).toFixed(0)} KB • {file.type || "image"}
                          </span>
                          <span className="text-slate-500 mt-1 leading-relaxed">
                            AI will read all text, questions, and options visible in this image
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Extraction scope choice */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Extraction scope</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExtractAll(true)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        extractAll
                          ? "border-[#dca54c] bg-[#1a2233] ring-1 ring-[#dca54c]/40 text-white"
                          : "border-slate-800 bg-[#161f2e]/60 text-slate-400 hover:text-slate-200 hover:bg-[#161f2e]"
                      }`}
                    >
                      <Zap
                        className={`h-4 w-4 mt-0.5 shrink-0 ${extractAll ? "text-[#dca54c]" : "text-slate-400"}`}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <span>⚡ Extract ALL MCQs in {extractKind}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Exhaustive scan of all pages to capture 100% of questions found
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExtractAll(false)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        !extractAll
                          ? "border-[#dca54c] bg-[#1a2233] ring-1 ring-[#dca54c]/40 text-white"
                          : "border-slate-800 bg-[#161f2e]/60 text-slate-400 hover:text-slate-200 hover:bg-[#161f2e]"
                      }`}
                    >
                      <Layers
                        className={`h-4 w-4 mt-0.5 shrink-0 ${!extractAll ? "text-[#dca54c]" : "text-slate-400"}`}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-100">
                          🗎 Extract specific amount
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Limit extraction up to {extractCount} questions
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Dropdowns row */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      File into chapter (optional)
                    </label>
                    <select
                      value={extractChapterId}
                      onChange={(e) => setExtractChapterId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                    >
                      <option value="">Decide during review</option>
                      {subjects.map((s) => (
                        <optgroup key={s.id} label={s.name} className="bg-[#131924] text-slate-200">
                          {chapters
                            .filter((c) => c.subject_id === s.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Extraction mode
                    </label>
                    {extractAll ? (
                      <div className="flex h-[38px] items-center rounded-xl border border-slate-800 bg-[#161f2e] px-3 text-xs text-slate-200">
                        <span>Complete document scan (all questions)</span>
                      </div>
                    ) : (
                      <select
                        value={String(extractCount)}
                        onChange={(e) => setExtractCount(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                      >
                        {[5, 10, 15, 20, 25, 30, 50, 75, 100].map((n) => (
                          <option key={n} value={n}>
                            Up to {n} questions
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Extract Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  id="btn-extract-mcqs"
                  onClick={handleExtract}
                  disabled={busy}
                  className="w-full py-3 px-4 rounded-xl bg-[#dca54c] hover:bg-[#e5a842] text-zinc-950 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-950" />
                      <span>{busyMessage || "Extracting MCQs from document…"}</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>
                        {extractKind === "pdf" && extractAll
                          ? "Extract ALL MCQs in PDF (full multi-page scan)"
                          : extractKind === "pdf"
                            ? `Extract ${extractCount} MCQs from PDF`
                            : extractKind === "image"
                              ? "Extract MCQs from image"
                              : "Extract MCQs from text"}
                      </span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              /* =================== GENERATE / MAKE SIMILAR MODE =================== */
              <motion.div
                key="tab-generate"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-slate-800/80 bg-[#131924] p-6 shadow-sm space-y-4"
              >
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Generate from chapter & make similar
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate new syllabus-aligned questions, or create similar drills based on an
                    existing question.
                  </p>
                </div>

                {/* Subject and Chapter Selectors */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Select subject
                    </label>
                    <select
                      value={genSubjectId}
                      onChange={(e) => {
                        setGenSubjectId(e.target.value);
                        setGenChapterId("");
                        setReferenceMcqId("");
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                    >
                      <option value="">Choose a subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Select chapter
                    </label>
                    <select
                      value={genChapterId}
                      onChange={(e) => {
                        setGenChapterId(e.target.value);
                        setReferenceMcqId("");
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                    >
                      <option value="">Choose a chapter</option>
                      {availableGenChapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Make Similar Reference Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Make similar to an existing question (optional)
                  </label>
                  <select
                    value={referenceMcqId}
                    onChange={(e) => setReferenceMcqId(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                  >
                    <option value="">
                      Generate new questions from chapter topics (no reference)
                    </option>
                    {chapterMcqs.map((m, idx) => (
                      <option key={m.id} value={m.id}>
                        Q{idx + 1}: {m.question.slice(0, 80)}...
                      </option>
                    ))}
                  </select>

                  {selectedReferenceMcq && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="rounded-xl border border-[#dca54c]/40 bg-[#1a2233] p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#dca54c] flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Reference Question:
                        </span>
                        <button
                          onClick={() => setReferenceMcqId("")}
                          className="text-slate-400 hover:text-white text-[11px] underline"
                        >
                          Clear reference
                        </button>
                      </div>
                      <p className="font-medium text-slate-100 text-xs">
                        {selectedReferenceMcq.question}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 text-slate-400 text-[11px]">
                        {selectedReferenceMcq.options.map((opt, i) => (
                          <div
                            key={i}
                            className={
                              i === selectedReferenceMcq.correct_index
                                ? "font-semibold text-emerald-400"
                                : ""
                            }
                          >
                            {String.fromCharCode(65 + i)}) {opt}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 3 Fields: Topic, Difficulty, Count */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Specific topic / concept
                    </label>
                    <input
                      type="text"
                      value={topicPrompt}
                      onChange={(e) => setTopicPrompt(e.target.value)}
                      placeholder="e.g. Carnot cycle, mitosis"
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#dca54c] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Difficulty level
                    </label>
                    <select
                      value={genDifficulty}
                      onChange={(e) =>
                        setGenDifficulty(e.target.value as "all" | "easy" | "medium" | "hard")
                      }
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                    >
                      <option value="all">Mixed (all levels)</option>
                      <option value="easy">Easy (fundamentals)</option>
                      <option value="medium">Medium (standard exam)</option>
                      <option value="hard">Hard (advanced traps)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Question count
                    </label>
                    <select
                      value={String(genCount)}
                      onChange={(e) => setGenCount(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-[#161f2e] px-3.5 py-2 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                    >
                      {[5, 8, 10, 15, 20].map((n) => (
                        <option key={n} value={n}>
                          {n} questions
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Generate CTA */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  id="btn-generate-mcqs"
                  onClick={handleGenerate}
                  disabled={busy}
                  className="w-full py-3 px-4 rounded-xl bg-[#dca54c] hover:bg-[#e5a842] text-zinc-950 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-950" />
                      <span>{busyMessage || "Generating questions…"}</span>
                    </>
                  ) : (
                    <>
                      <span>✦</span>
                      <span>
                        {selectedReferenceMcq
                          ? `Generate ${genCount} similar questions for chapter`
                          : `Generate ${genCount} questions from chapter syllabus`}
                      </span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* =================== REVIEW QUEUE SECTION =================== */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#131924] p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Review & approval queue
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review generated questions, edit, or approve directly into your chapters.
                </p>
              </div>

              {pendingMcqs.length > 0 && (
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleApproveAll}
                    id="btn-approve-all-mcqs"
                    className="flex items-center gap-1.5 rounded-lg bg-[#dca54c] px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-[#e5a842] transition-colors shadow-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve all ({pendingMcqs.length})
                  </motion.button>
                  <button
                    onClick={handleRejectAll}
                    id="btn-reject-all-mcqs"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#161f2e] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-colors"
                  >
                    Discard all
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {pendingMcqs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center space-y-2 bg-[#161f2e]/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto opacity-70" />
                  <p className="text-sm font-semibold text-slate-200">Queue is clear</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No questions pending review. Extract from a PDF or generate questions above to
                    populate your question bank.
                  </p>
                  <button
                    onClick={handleLoadDemoSample}
                    className="mt-2 text-xs text-[#dca54c] hover:underline inline-flex items-center gap-1"
                  >
                    Load demo MCQ review card
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {pendingMcqs.map((m) => (
                    <ReviewCard
                      key={m.id}
                      mcq={m}
                      subjects={subjects}
                      chapters={chapters}
                      onDecide={decide}
                      onMakeSimilar={() => handleMakeSimilarFromCard(m)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReviewCard({
  mcq,
  subjects,
  chapters,
  onDecide,
  onMakeSimilar,
}: {
  mcq: Mcq;
  subjects: { id: string; name: string }[];
  chapters: { id: string; name: string; subject_id: string }[];
  onDecide: (id: string, status: "approved" | "rejected", targetChapterId?: string) => void;
  onMakeSimilar: () => void;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState(mcq.chapter_id ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState(mcq.question);
  const [editOptions, setEditOptions] = useState([...mcq.options]);
  const [editCorrectIndex, setEditCorrectIndex] = useState(mcq.correct_index);
  const [editExplanation, setEditExplanation] = useState(mcq.explanation ?? "");

  const handleSaveEdit = async () => {
    const { error } = await supabase
      .from("mcqs")
      .update({
        question: editQuestion,
        options: editOptions,
        correct_index: editCorrectIndex,
        explanation: editExplanation || null,
      })
      .eq("id", mcq.id);

    if (error) {
      toast.error("Failed to update question: " + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["mcqs"] });
    setIsEditing(false);
    toast.success("Question edits saved!");
  };

  const difficulty = (mcq.difficulty || "medium").toLowerCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-800 bg-[#161f2e] p-5 shadow-xs transition-all space-y-3.5"
    >
      {/* Top Badges and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {difficulty === "easy" ? (
            <span className="rounded-md bg-emerald-950/70 border border-emerald-600/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 capitalize">
              Easy
            </span>
          ) : difficulty === "hard" ? (
            <span className="rounded-md bg-rose-950/70 border border-rose-600/40 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400 capitalize">
              Hard
            </span>
          ) : (
            <span className="rounded-md bg-amber-950/70 border border-amber-600/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 capitalize">
              Medium
            </span>
          )}

          {mcq.origin === "extracted" && (
            <span className="rounded-md bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              Extracted
            </span>
          )}
          {mcq.origin === "similar_ai" && (
            <span className="rounded-md bg-blue-950/50 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
              Similar Drill
            </span>
          )}

          {mcq.tags?.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-md bg-[#101726] border border-slate-700/60 px-2.5 py-0.5 text-[11px] text-slate-300 capitalize"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMakeSimilar}
            title="Generate questions similar to this one"
            className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#101726] px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-[#dca54c] hover:text-[#dca54c] transition-colors"
          >
            <span>✦</span>
            <span>Make similar</span>
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#101726] px-2.5 py-1 text-xs text-slate-200 hover:border-slate-500 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>{isEditing ? "Cancel" : "Edit"}</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Question text</label>
            <input
              type="text"
              value={editQuestion}
              onChange={(e) => setEditQuestion(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#101726] p-3 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Options (Select radio for correct answer)
            </span>
            {editOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${mcq.id}`}
                  checked={editCorrectIndex === i}
                  onChange={() => setEditCorrectIndex(i)}
                  className="accent-[#dca54c] h-4 w-4 cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-slate-400 w-4">
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...editOptions];
                    next[i] = e.target.value;
                    setEditOptions(next);
                  }}
                  className="flex-1 rounded-lg border border-slate-700 bg-[#101726] px-3 py-1.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Explanation</label>
            <textarea
              rows={2}
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#101726] p-2.5 text-xs text-slate-100 focus:border-[#dca54c] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="rounded-lg bg-[#dca54c] px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-[#e5a842]"
            >
              Save changes
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Question Text */}
          <p className="text-sm font-semibold text-white leading-relaxed">{mcq.question}</p>

          {/* 2x2 Option Grid */}
          <div className="grid gap-2 sm:grid-cols-2">
            {mcq.options.map((o, i) => {
              const isCorrect = i === mcq.correct_index;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs transition-all ${
                    isCorrect
                      ? "border-emerald-500/70 bg-[#064e3b]/20 font-medium text-emerald-300"
                      : "border-slate-800 bg-[#101726] text-slate-300"
                  }`}
                >
                  <span className="leading-snug">{o}</span>
                  {isCorrect && <span className="text-emerald-400 font-bold ml-2">✓</span>}
                </div>
              );
            })}
          </div>

          {/* Explanation box */}
          {mcq.explanation && (
            <div className="rounded-xl border border-emerald-500/20 bg-[#064e3b]/15 p-3 text-xs leading-relaxed text-slate-300">
              <strong className="text-emerald-400 font-semibold">Explanation — </strong>
              {mcq.explanation.replace(/^Explanation\s*[:—–-]\s*/i, "")}
            </div>
          )}
        </>
      )}

      {/* Target Chapter Filing and Approval Action */}
      <div className="flex flex-col gap-2 pt-3 border-t border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <span className="text-xs text-slate-400 shrink-0">File into</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-[#101726] px-3 py-1.5 text-xs text-slate-200 focus:border-[#dca54c] focus:outline-none"
          >
            <option value="">Unfiled</option>
            {subjects.map((s) => (
              <optgroup key={s.id} label={s.name} className="bg-[#131924] text-slate-200">
                {chapters
                  .filter((c) => c.subject_id === s.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onDecide(mcq.id, "approved", target || undefined)}
            className="flex items-center gap-1.5 rounded-lg bg-[#dca54c] hover:bg-[#e5a842] px-4 py-1.5 text-xs font-bold text-zinc-950 transition-colors shadow-xs"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Approve & add</span>
          </motion.button>
          <button
            onClick={() => onDecide(mcq.id, "rejected")}
            className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-[#101726] px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reject</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
