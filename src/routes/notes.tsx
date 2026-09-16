import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  Pin,
  Search,
  CheckCircle2,
  Sparkles,
  Tag as TagIcon,
  Clock,
  FileText,
  Eye,
  Edit3,
  FolderPlus,
  Layers,
  Save,
  Bold,
  Italic,
  List,
  Highlighter,
  Download,
  Copy,
  HelpCircle,
  Zap,
  ArrowRight,
  RefreshCw,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Input, Textarea, Field, Tag, Badge } from "@/components/app/kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { notesQuery, subjectsQuery, type Note, type Subject } from "@/lib/queries";
import {
  generateSummary,
  generateFlashcards,
  explainConcept,
  generateMcqs,
  type GeneratedFlashcard,
  type ConceptExplanation,
  type GeneratedMcq,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes & Concepts — Study Spark" },
      {
        name: "description",
        content:
          "Organize learning concepts by subject, write study notes, formulas and key takeaways with AI summary, flashcards and explanations.",
      },
      { property: "og:title", content: "Notes & Concepts — Study Spark" },
      {
        property: "og:description",
        content: "Study notes and concept notebook organized by subject with AI assist.",
      },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notes = [] } = useQuery(notesQuery());
  const { data: subjects = [] } = useQuery(subjectsQuery());

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Subject creation modal state
  const [showNewSubjectModal, setShowNewSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDesc, setNewSubjectDesc] = useState("");

  // Subject deletion state
  const [deleteSubjectConfirmId, setDeleteSubjectConfirmId] = useState<string | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);

  // Current active note form state
  const [activeTitle, setActiveTitle] = useState("");
  const [activeSubjectId, setActiveSubjectId] = useState<string>("");
  const [activeContent, setActiveContent] = useState("");
  const [activePinned, setActivePinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI Tool Modal States (Summary, Flashcards, Explanations, Questions)
  const [aiModalType, setAiModalType] = useState<
    "summary" | "flashcards" | "explain" | "mcqs" | null
  >(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // AI Generated Results for Review
  const [generatedSummaryText, setGeneratedSummaryText] = useState("");
  const [generatedCards, setGeneratedCards] = useState<GeneratedFlashcard[]>([]);
  const [explainLevel, setExplainLevel] = useState<"beginner" | "exam" | "advanced">("exam");
  const [generatedExplanation, setGeneratedExplanation] = useState<ConceptExplanation | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedMcq[]>([]);

  // Filter notes by selected subject and search query
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        if (selectedSubjectId !== "all" && n.subject_id !== selectedSubjectId) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchContent = (n.plain_text_content || "").toLowerCase().includes(q);
          return matchTitle || matchContent;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [notes, selectedSubjectId, searchQuery]);

  // Set default active note if none is selected
  useEffect(() => {
    if (!selectedNoteId && filteredNotes.length > 0) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  // Sync active note state when selectedNoteId changes
  useEffect(() => {
    if (!selectedNoteId) {
      setActiveTitle("");
      setActiveSubjectId("");
      setActiveContent("");
      setActivePinned(false);
      return;
    }
    const note = notes.find((n) => n.id === selectedNoteId);
    if (note) {
      setActiveTitle(note.title);
      setActiveSubjectId(note.subject_id || "");
      setActiveContent(note.plain_text_content || "");
      setActivePinned(Boolean(note.is_pinned));
    }
  }, [selectedNoteId, notes]);

  // Create a new note
  const handleCreateNote = async () => {
    const targetSubjectId =
      selectedSubjectId !== "all" ? selectedSubjectId : subjects[0]?.id || null;
    const targetSubject = subjects.find((s) => s.id === targetSubjectId);

    const newNotePayload = {
      user_id: user?.id,
      title: `New Concept Note (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
      subject_id: targetSubjectId,
      chapter_id: null,
      category_id: null,
      content: {},
      plain_text_content:
        "### Key Concept\n\nWrite your concepts, explanations, and key learning formulas here.",
      is_pinned: false,
      color: "accent",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_opened_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("notes").insert(newNotePayload);
    if (error) {
      toast.error(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ["notes"] });
    const createdId = (data as { id?: string })?.id || (Array.isArray(data) && data[0]?.id);
    if (createdId) {
      setSelectedNoteId(createdId);
    }
    toast.success(
      targetSubject ? `Note added to ${targetSubject.name}` : "New concept note created",
    );
  };

  // Save current active note
  const handleSaveNote = async () => {
    if (!selectedNoteId) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("notes")
      .update({
        title: activeTitle.trim() || "Untitled Note",
        subject_id: activeSubjectId || null,
        plain_text_content: activeContent,
        is_pinned: activePinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedNoteId);

    setIsSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ["notes"] });
    toast.success("Note saved successfully");
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to delete this study note?")) return;

    const { error } = await supabase.from("notes").delete().eq("id", noteId);
    if (error) {
      toast.error(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ["notes"] });
    if (selectedNoteId === noteId) {
      setSelectedNoteId(null);
    }
    toast.success("Note deleted");
  };

  // Create new subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error("Please enter a subject name");
      return;
    }

    const { data, error } = await supabase.from("subjects").insert({
      user_id: user?.id,
      name: newSubjectName.trim(),
      description: newSubjectDesc.trim() || null,
      color: "accent",
      position: subjects.length,
      created_at: new Date().toISOString(),
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ["subjects"] });
    const created = Array.isArray(data) ? data[0] : data;
    if (created?.id) {
      setSelectedSubjectId(created.id);
    }
    setShowNewSubjectModal(false);
    setNewSubjectName("");
    setNewSubjectDesc("");
    toast.success("Subject created! You can now add notes inside it.");
  };

  const handleDeleteSubject = async () => {
    if (!deleteSubjectConfirmId) return;
    const subject = subjects.find((item) => item.id === deleteSubjectConfirmId);
    if (!subject) return;

    setIsDeletingSubject(true);
    try {
      const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
      if (error) throw new Error(error.message);

      if (selectedSubjectId === subject.id) setSelectedSubjectId("all");
      if (activeSubjectId === subject.id) setActiveSubjectId("");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["chapters"] });
      setDeleteSubjectConfirmId(null);
      toast.success(`${subject.name} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this subject.");
    } finally {
      setIsDeletingSubject(false);
    }
  };

  // Insert formatting helper
  const insertFormatting = (prefix: string, suffix = "") => {
    setActiveContent((prev) => prev + `\n${prefix} ` + suffix);
  };

  const wordCount = useMemo(() => {
    return (activeContent.trim().match(/\S+/g) || []).length;
  }, [activeContent]);

  // AI Handler: Summary
  const handleTriggerSummary = async () => {
    if (!activeContent.trim()) {
      toast.error("Add some text to your note before summarizing.");
      return;
    }
    setAiModalType("summary");
    setIsAiLoading(true);
    try {
      const res = await generateSummary({
        data: { text: activeContent, topic: activeTitle },
      });
      setGeneratedSummaryText(res.summary);
      toast.success("Summary generated! Review and edit before applying.");
    } catch (e) {
      toast.error("Summary error: " + String(e));
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Handler: Flashcards
  const handleTriggerFlashcards = async () => {
    if (!activeContent.trim()) {
      toast.error("Add text to your note to generate flashcards.");
      return;
    }
    setAiModalType("flashcards");
    setIsAiLoading(true);
    try {
      const res = await generateFlashcards({
        data: { text: activeContent, topic: activeTitle, count: 6 },
      });
      setGeneratedCards(res.flashcards || []);
      toast.success("Flashcards created! Review and edit before saving.");
    } catch (e) {
      toast.error("Flashcards error: " + String(e));
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Handler: Explain Concept
  const handleTriggerExplain = async (level = explainLevel) => {
    const conceptToExplain = activeTitle || activeContent.slice(0, 100);
    if (!conceptToExplain.trim()) {
      toast.error("Please provide a note title or concept name.");
      return;
    }
    setAiModalType("explain");
    setIsAiLoading(true);
    setExplainLevel(level);
    try {
      const res = await explainConcept({
        data: { concept: conceptToExplain, context: activeContent.slice(0, 500), level },
      });
      setGeneratedExplanation(res.explanation);
      toast.success("Concept explained! Review and edit before saving.");
    } catch (e) {
      toast.error("Explain error: " + String(e));
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Handler: Generate Questions
  const handleTriggerQuestions = async () => {
    if (!activeContent.trim()) {
      toast.error("Add text to your note before generating practice questions.");
      return;
    }
    setAiModalType("mcqs");
    setIsAiLoading(true);
    try {
      const res = await generateMcqs({
        data: { kind: "text", text: activeContent, topic: activeTitle, count: 4 },
      });
      setGeneratedQuestions(res.mcqs || []);
      toast.success("MCQs generated! Review and edit before adding to Question Bank.");
    } catch (e) {
      toast.error("Questions error: " + String(e));
    } finally {
      setIsAiLoading(false);
    }
  };

  // Commit Approved Questions to MCQs bank
  const handleApproveQuestions = async () => {
    if (!user || generatedQuestions.length === 0) return;
    try {
      for (const q of generatedQuestions) {
        await supabase.from("mcqs").insert({
          user_id: user.id,
          subject_id: activeSubjectId || null,
          chapter_id: null,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation || null,
          difficulty: q.difficulty || "medium",
          status: "approved",
          origin: "ai",
          tags: q.tags || [],
        });
      }
      qc.invalidateQueries({ queryKey: ["mcqs"] });
      setAiModalType(null);
      toast.success(`Saved ${generatedQuestions.length} questions into Question Bank!`);
    } catch (e) {
      toast.error("Failed to save questions: " + String(e));
    }
  };

  // Download Note as PDF for offline review
  const downloadNoteAsPDF = (noteData: {
    title: string;
    plain_text_content?: string;
    subject_id?: string | null;
  }) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const sub = subjects.find((s) => s.id === noteData.subject_id);
      const subjectName = sub?.name || "General Study";
      const noteTitle = noteData.title.trim() || "Untitled Study Note";
      const content = noteData.plain_text_content || "No concept text recorded yet.";

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 45;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin - 25) {
          doc.addPage();
          y = margin;
          drawPageHeader();
        }
      };

      const drawPageHeader = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(140, 140, 145);
        doc.text("Study Spark — Offline Study & Concept Review", margin, y);
        const dateStr = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        doc.text(dateStr, pageWidth - margin, y, { align: "right" });
        y += 10;
        doc.setDrawColor(225, 225, 230);
        doc.setLineWidth(0.75);
        doc.line(margin, y, pageWidth - margin, y);
        y += 20;
      };

      drawPageHeader();

      // Subject Pill Tag
      doc.setFillColor(242, 244, 248);
      doc.setDrawColor(210, 218, 230);
      const tagText = subjectName.toUpperCase();
      const tagWidth = Math.min(220, doc.getTextWidth(tagText) + 18);
      doc.roundedRect(margin, y, tagWidth, 18, 4, 4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(28, 55, 120);
      doc.text(tagText, margin + 9, y + 12);
      y += 28;

      // Note Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(20, 20, 25);
      const titleLines = doc.splitTextToSize(noteTitle, contentWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 22 + 6;

      doc.setDrawColor(230, 230, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 18;

      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("### ")) {
          checkPageBreak(30);
          y += 8;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12.5);
          doc.setTextColor(35, 35, 40);
          const headingText = line.replace(/^###\s+/, "");
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 16 + 6;
        } else if (line.startsWith("## ")) {
          checkPageBreak(35);
          y += 12;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14.5);
          doc.setTextColor(20, 20, 28);
          const headingText = line.replace(/^##\s+/, "");
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 18 + 8;
        } else if (line.startsWith("# ")) {
          checkPageBreak(40);
          y += 14;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.setTextColor(15, 15, 20);
          const headingText = line.replace(/^#\s+/, "");
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 20 + 8;
        } else if (line.startsWith("> ")) {
          const calloutText = line.replace(/^>\s+/, "");
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          const cLines = doc.splitTextToSize(calloutText, contentWidth - 26);
          const boxHeight = cLines.length * 14 + 16;
          checkPageBreak(boxHeight + 8);

          doc.setFillColor(248, 250, 253);
          doc.setDrawColor(215, 225, 238);
          doc.roundedRect(margin, y, contentWidth, boxHeight, 4, 4, "FD");

          doc.setFillColor(59, 130, 246);
          doc.rect(margin, y, 3.5, boxHeight, "F");

          doc.setTextColor(45, 55, 75);
          doc.text(cLines, margin + 14, y + 13);
          y += boxHeight + 10;
        } else if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
          const bulletText = line.replace(/^[•\-*]\s+/, "");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(45, 45, 50);
          const bLines = doc.splitTextToSize(bulletText, contentWidth - 18);
          checkPageBreak(bLines.length * 14 + 4);

          doc.setFillColor(80, 80, 90);
          doc.circle(margin + 5, y - 3, 2, "F");

          doc.text(bLines, margin + 14, y);
          y += bLines.length * 14 + 5;
        } else if (line.startsWith("$$") || line.endsWith("$$")) {
          const formulaText = line.replace(/\$\$/g, "").trim();
          doc.setFont("courier", "bold");
          doc.setFontSize(10.5);
          const fLines = doc.splitTextToSize(formulaText, contentWidth - 24);
          const fHeight = fLines.length * 15 + 14;
          checkPageBreak(fHeight + 8);

          doc.setFillColor(247, 248, 250);
          doc.setDrawColor(225, 227, 232);
          doc.roundedRect(margin, y, contentWidth, fHeight, 3, 3, "FD");
          doc.setTextColor(20, 25, 35);
          doc.text(fLines, margin + 12, y + 13);
          y += fHeight + 8;
        } else if (!line.trim()) {
          y += 7;
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(45, 45, 50);
          const cleanText = line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
          const pLines = doc.splitTextToSize(cleanText, contentWidth);
          checkPageBreak(pLines.length * 14 + 5);
          doc.text(pLines, margin, y);
          y += pLines.length * 14 + 5;
        }
      }

      const totalPages = (
        doc.internal as unknown as { getNumberOfPages: () => number }
      ).getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 155);
        doc.text("Study Spark — Study Notes & Concepts", margin, pageHeight - margin / 2);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - margin / 2, {
          align: "right",
        });
      }

      const safeFilename = noteTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      doc.save(`${safeFilename || "study-note"}.pdf`);
      toast.success(`Downloaded "${noteTitle}" as PDF`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <AppShell
      title="Study Notes & Learn"
      subtitle="Organize learning notes by subject, write concepts and study theoretical takeaways with AI assist"
      actions={
        <div className="flex items-center gap-2">
          <Btn
            variant="ghost"
            onClick={() => setShowNewSubjectModal(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <FolderPlus className="size-3.5" />
            <span>New Subject</span>
          </Btn>
          <Btn onClick={handleCreateNote} className="flex items-center gap-1.5 text-xs">
            <Plus className="size-3.5" />
            <span>Create Note</span>
          </Btn>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: SUBJECTS & NOTES LIST */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4 lg:col-span-5 xl:col-span-4"
        >
          {/* Subject Filter Bar */}
          <Panel className="p-3.5 border-border/70 bg-surface/90">
            <div className="flex items-center justify-between pb-2 border-b border-border-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Layers className="size-3.5 text-accent" />
                <span>Subjects</span>
              </span>
              <button
                type="button"
                onClick={() => setShowNewSubjectModal(true)}
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Add Subject</span>
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedSubjectId("all")}
                className={`relative rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  selectedSubjectId === "all"
                    ? "bg-accent text-accent-contrast shadow-xs font-semibold"
                    : "bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                All Subjects ({notes.length})
              </button>
              {subjects.map((sub) => {
                const subNotesCount = notes.filter((n) => n.subject_id === sub.id).length;
                const isSelected = selectedSubjectId === sub.id;
                return (
                  <div key={sub.id} className="group inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={`relative rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-accent text-accent-contrast shadow-xs font-semibold"
                          : "bg-surface-2 text-muted hover:text-foreground"
                      }`}
                    >
                      {sub.name} ({subNotesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteSubjectConfirmId(sub.id)}
                      className="grid size-6 place-items-center rounded-md text-faint opacity-0 transition hover:bg-rose/10 hover:text-rose group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Delete ${sub.name}`}
                      title={`Delete ${sub.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Search Notes & Create Action */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search notes & concepts…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border-2 bg-surface pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none shadow-2xs"
              />
            </div>
            <Btn
              onClick={handleCreateNote}
              className="shrink-0 px-3 py-2 text-xs gap-1.5 shadow-xs"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New</span>
            </Btn>
          </div>

          {/* Notes List with Framer Motion Stagger and Sliding */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredNotes.length === 0 ? (
                <motion.div
                  key="empty-notes-list"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-dashed border-border-2 p-8 text-center bg-surface/50"
                >
                  <BookOpen className="mx-auto size-8 text-muted/50" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No notes in this subject
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Create your first concept note to start writing.
                  </p>
                  <Btn onClick={handleCreateNote} className="mt-3 text-xs">
                    Create Note
                  </Btn>
                </motion.div>
              ) : (
                filteredNotes.map((note, idx) => {
                  const sub = subjects.find((s) => s.id === note.subject_id);
                  const isSelected = selectedNoteId === note.id;
                  const snippet = (note.plain_text_content || "")
                    .replace(/^[#>\s*`-]+/gm, "")
                    .slice(0, 85);

                  return (
                    <motion.div
                      key={note.id}
                      layout
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        duration: 0.22,
                        delay: Math.min(idx * 0.025, 0.25),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{ x: 2 }}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`group cursor-pointer rounded-xl border p-3.5 transition-all shadow-2xs ${
                        isSelected
                          ? "border-accent bg-accent/8 ring-1 ring-accent shadow-xs"
                          : "border-border-2 bg-surface hover:border-border-1 hover:bg-surface-2/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-sm font-semibold tracking-tight line-clamp-1 ${
                            isSelected ? "text-accent" : "text-foreground"
                          }`}
                        >
                          {note.title || "Untitled Note"}
                        </h4>
                        {note.is_pinned && (
                          <Pin className="size-3 text-accent shrink-0 fill-accent" />
                        )}
                      </div>

                      <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed">
                        {snippet || "No additional text written yet."}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                        <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-muted font-medium">
                          {sub?.name || "General"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span>
                            {new Date(note.updated_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadNoteAsPDF(note);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-accent rounded hover:bg-surface-3 cursor-pointer"
                            title="Download note as PDF"
                          >
                            <Download className="size-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* RIGHT COLUMN: NOTE WRITER & CONCEPT WORKSPACE */}
        <div className="lg:col-span-7 xl:col-span-8">
          <AnimatePresence mode="wait">
            {selectedNoteId ? (
              <motion.div
                key={selectedNoteId}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <Panel className="flex flex-col h-full min-h-[580px] p-5 border-border/80 bg-surface/95 shadow-sm">
                  {/* Note Header Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-2 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={activeSubjectId}
                        onChange={(e) => setActiveSubjectId(e.target.value)}
                        className="rounded-lg border border-border-2 bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
                      >
                        <option value="">Select Subject…</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setActivePinned((p) => !p)}
                        className={`rounded-lg border border-border-2 p-1.5 text-xs transition cursor-pointer ${
                          activePinned
                            ? "bg-accent/15 text-accent border-accent/40"
                            : "text-muted hover:text-foreground"
                        }`}
                        title={activePinned ? "Pinned Note" : "Pin Note"}
                      >
                        <Pin className={`size-3.5 ${activePinned ? "fill-accent" : ""}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewMode((p) => !p)}
                        className="rounded-lg border border-border-2 bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        {previewMode ? (
                          <Edit3 className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                        <span>{previewMode ? "Edit Mode" : "Read Preview"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadNoteAsPDF({
                            title: activeTitle,
                            plain_text_content: activeContent,
                            subject_id: activeSubjectId,
                          })
                        }
                        className="rounded-lg border border-border-2 bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-3 transition flex items-center gap-1.5 cursor-pointer"
                        title="Download this note as PDF for offline review"
                      >
                        <Download className="size-3.5 text-accent" />
                        <span>PDF</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted font-mono">{wordCount} words</span>
                      <Btn
                        variant="solid"
                        onClick={handleSaveNote}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                      >
                        <Save className="size-3.5" />
                        <span>{isSaving ? "Saving…" : "Save"}</span>
                      </Btn>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(selectedNoteId)}
                        className="rounded-lg border border-border-2 p-1.5 text-muted hover:text-rose-500 hover:border-rose-500/30 transition cursor-pointer"
                        title="Delete Note"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title Input */}
                  <div className="pt-4">
                    <input
                      type="text"
                      value={activeTitle}
                      onChange={(e) => setActiveTitle(e.target.value)}
                      placeholder="Note Title (e.g. Newton's Laws & Momentum Principles)"
                      className="w-full bg-transparent text-xl font-bold tracking-tight text-foreground placeholder:text-muted/60 focus:outline-none"
                    />
                  </div>

                  {/* AI Study Actions Bar with Motion Highlights */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-2 text-xs">
                    <span className="font-semibold text-accent flex items-center gap-1 mr-1">
                      <Sparkles className="size-3.5" /> AI Actions:
                    </span>
                    <button
                      type="button"
                      onClick={handleTriggerSummary}
                      className="rounded-lg border border-accent/30 bg-surface px-2.5 py-1 font-medium text-foreground hover:bg-accent/15 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Zap className="size-3 text-accent" /> Summarize
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerFlashcards}
                      className="rounded-lg border border-accent/30 bg-surface px-2.5 py-1 font-medium text-foreground hover:bg-accent/15 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Layers className="size-3 text-accent" /> Flashcards
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerExplain("exam")}
                      className="rounded-lg border border-accent/30 bg-surface px-2.5 py-1 font-medium text-foreground hover:bg-accent/15 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <HelpCircle className="size-3 text-accent" /> Explain Concept
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerQuestions}
                      className="rounded-lg border border-accent/30 bg-surface px-2.5 py-1 font-medium text-foreground hover:bg-accent/15 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="size-3 text-accent" /> Generate MCQs
                    </button>
                  </div>

                  {/* Formatting Toolbar */}
                  {!previewMode && (
                    <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg border border-border-2 bg-surface-2/40 p-1 text-xs text-muted">
                      <button
                        type="button"
                        onClick={() => insertFormatting("**Bold Concept**")}
                        className="rounded p-1 hover:bg-surface-3 hover:text-foreground cursor-pointer"
                        title="Bold"
                      >
                        <Bold className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("*Italic*")}
                        className="rounded p-1 hover:bg-surface-3 hover:text-foreground cursor-pointer"
                        title="Italic"
                      >
                        <Italic className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("• Key learning point:")}
                        className="rounded p-1 hover:bg-surface-3 hover:text-foreground cursor-pointer"
                        title="Bullet Point"
                      >
                        <List className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("### Section Header")}
                        className="rounded px-1.5 py-0.5 font-bold hover:bg-surface-3 hover:text-foreground cursor-pointer"
                        title="Heading"
                      >
                        H3
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("$$ E = mc^2 $$")}
                        className="rounded p-1 hover:bg-surface-3 hover:text-foreground font-mono text-[11px] cursor-pointer"
                        title="Formula Block"
                      >
                        Formula
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("> Takeaway:")}
                        className="rounded p-1 hover:bg-surface-3 hover:text-foreground cursor-pointer"
                        title="Callout"
                      >
                        <Highlighter className="size-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Main Content Area: Editor or Formatted Preview */}
                  <div className="mt-4 flex-1">
                    {previewMode ? (
                      <div className="prose prose-invert max-w-none space-y-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {activeContent || (
                          <span className="italic text-muted">
                            Empty note. Switch to edit mode to write.
                          </span>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={activeContent}
                        onChange={(e) => setActiveContent(e.target.value)}
                        placeholder="Write your study concepts, theoretical explanations, formulas, definitions, and learning notes here…"
                        className="h-full min-h-[420px] w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted/60 focus:outline-none"
                      />
                    )}
                  </div>
                </Panel>
              </motion.div>
            ) : (
              <motion.div
                key="no-note-selected"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22 }}
              >
                <Panel className="flex flex-col items-center justify-center p-12 text-center min-h-[460px] border-border/80 bg-surface/80">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                    className="grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent border border-accent/30 shadow-md shadow-accent/10"
                  >
                    <BookOpen className="size-7" />
                  </motion.div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Select or Create a Note
                  </h3>
                  <p className="mt-1 text-xs text-muted max-w-sm leading-relaxed">
                    Pick a note from the left list, or click "Create Note" to write your concepts,
                    high-yield takeaways, and study summaries.
                  </p>
                  <Btn onClick={handleCreateNote} className="mt-5 text-xs shadow-xs gap-1.5">
                    <Plus className="size-3.5" />
                    <span>Create First Note</span>
                  </Btn>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AI Review & Edit Modal (Summary, Flashcards, Concept, Questions) */}
      <AnimatePresence>
        {aiModalType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4"
            >
              {/* Header with AI badge and dismiss */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {aiModalType === "summary" && "AI Summary & High-Yield Takeaways"}
                      {aiModalType === "flashcards" && "AI Generated Flashcards Deck"}
                      {aiModalType === "explain" && "AI Concept Breakdown & Intuition"}
                      {aiModalType === "mcqs" && "AI Practice Questions Generator"}
                    </h3>
                    <span className="inline-block mt-0.5 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                      Generated Content · Review, Edit or Reject
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalType(null)}
                  className="rounded-md p-1 text-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              {isAiLoading ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="size-8 mx-auto animate-spin text-accent" />
                  <p className="text-sm font-medium text-foreground">
                    Generating study content with AI…
                  </p>
                  <p className="text-xs text-muted">
                    Analyzing note concepts and high-yield relationships
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 1. Summary Review */}
                  {aiModalType === "summary" && (
                    <div className="space-y-3">
                      <Field label="Editable Summary Text:">
                        <Textarea
                          rows={8}
                          value={generatedSummaryText}
                          onChange={(e) => setGeneratedSummaryText(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </Field>
                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => setAiModalType(null)}
                          className="text-xs text-rose hover:underline"
                        >
                          Reject & Discard
                        </button>
                        <div className="flex gap-2">
                          <Btn
                            variant="outline"
                            onClick={() => {
                              setActiveContent((prev) => prev + "\n\n" + generatedSummaryText);
                              setAiModalType(null);
                              toast.success("Summary appended to note!");
                            }}
                          >
                            Append to Note
                          </Btn>
                          <Btn
                            onClick={() => {
                              setActiveContent(generatedSummaryText);
                              setAiModalType(null);
                              toast.success("Note replaced with summary!");
                            }}
                          >
                            Replace Note
                          </Btn>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Flashcards Review */}
                  {aiModalType === "flashcards" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted">
                        Review and edit individual front/back cards below before saving:
                      </p>
                      <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                        {generatedCards.map((c, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-semibold text-accent">
                                Card #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setGeneratedCards(generatedCards.filter((_, i) => i !== idx))
                                }
                                className="text-xs text-faint hover:text-rose"
                              >
                                Remove
                              </button>
                            </div>
                            <Input
                              value={c.front}
                              onChange={(e) => {
                                const updated = [...generatedCards];
                                updated[idx].front = e.target.value;
                                setGeneratedCards(updated);
                              }}
                              placeholder="Front / Question"
                              className="text-xs"
                            />
                            <Textarea
                              rows={2}
                              value={c.back}
                              onChange={(e) => {
                                const updated = [...generatedCards];
                                updated[idx].back = e.target.value;
                                setGeneratedCards(updated);
                              }}
                              placeholder="Back / Answer"
                              className="text-xs"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => setAiModalType(null)}
                          className="text-xs text-rose hover:underline"
                        >
                          Reject & Discard
                        </button>
                        <Btn
                          onClick={() => {
                            const formattedCards = generatedCards
                              .map((c, i) => `### Card ${i + 1}: ${c.front}\n**Answer:** ${c.back}`)
                              .join("\n\n");
                            setActiveContent(
                              (prev) => prev + "\n\n## Flashcards\n" + formattedCards,
                            );
                            setAiModalType(null);
                            toast.success(
                              `Saved ${generatedCards.length} flashcards to study notes!`,
                            );
                          }}
                        >
                          Approve & Append to Note
                        </Btn>
                      </div>
                    </div>
                  )}

                  {/* 3. Concept Explanation Review */}
                  {aiModalType === "explain" && generatedExplanation && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <span className="text-xs font-medium text-muted">Explanation Level:</span>
                        {(["beginner", "exam", "advanced"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleTriggerExplain(lvl)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${
                              explainLevel === lvl
                                ? "bg-accent text-accent-contrast"
                                : "bg-surface-2 text-muted hover:text-foreground"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-xl border border-border bg-surface-2/30 p-4 space-y-3 text-xs leading-relaxed">
                        <div>
                          <span className="font-semibold text-accent uppercase tracking-wider text-[10px]">
                            Core Summary
                          </span>
                          <p className="mt-1 text-foreground font-medium">
                            {generatedExplanation.summary}
                          </p>
                        </div>

                        {generatedExplanation.analogies && (
                          <div>
                            <span className="font-semibold text-amber uppercase tracking-wider text-[10px]">
                              Intuitive Analogy
                            </span>
                            <p className="mt-1 text-muted italic">
                              {generatedExplanation.analogies}
                            </p>
                          </div>
                        )}

                        <div>
                          <span className="font-semibold text-accent uppercase tracking-wider text-[10px]">
                            Key Points
                          </span>
                          <ul className="mt-1 space-y-1 list-disc pl-4 text-muted">
                            {generatedExplanation.keyPoints.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                            Exam Application & Tips
                          </span>
                          <p className="mt-1 text-muted">{generatedExplanation.examApplication}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => setAiModalType(null)}
                          className="text-xs text-rose hover:underline"
                        >
                          Reject & Discard
                        </button>
                        <Btn
                          onClick={() => {
                            const formatted = `### Concept Explanation: ${generatedExplanation.concept}\n**Summary:** ${generatedExplanation.summary}\n\n**Key Points:**\n${generatedExplanation.keyPoints.map((p) => `• ${p}`).join("\n")}\n\n**Exam Application:** ${generatedExplanation.examApplication}`;
                            setActiveContent((prev) => prev + "\n\n" + formatted);
                            setAiModalType(null);
                            toast.success("Explanation appended to note!");
                          }}
                        >
                          Approve & Append to Note
                        </Btn>
                      </div>
                    </div>
                  )}

                  {/* 4. MCQs Practice Questions Review */}
                  {aiModalType === "mcqs" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted">
                        Review, edit, and approve multiple choice questions before adding them to
                        your question bank:
                      </p>
                      <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                        {generatedQuestions.map((q, qIdx) => (
                          <div
                            key={qIdx}
                            className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-semibold text-accent">
                                Question {qIdx + 1} ({q.difficulty})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setGeneratedQuestions(
                                    generatedQuestions.filter((_, i) => i !== qIdx),
                                  )
                                }
                                className="text-xs text-faint hover:text-rose"
                              >
                                Remove
                              </button>
                            </div>
                            <Input
                              value={q.question}
                              onChange={(e) => {
                                const updated = [...generatedQuestions];
                                updated[qIdx].question = e.target.value;
                                setGeneratedQuestions(updated);
                              }}
                              className="text-xs font-medium"
                            />
                            <div className="space-y-1 pl-2">
                              {q.options.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-${qIdx}`}
                                    checked={q.correct_index === optIdx}
                                    onChange={() => {
                                      const updated = [...generatedQuestions];
                                      updated[qIdx].correct_index = optIdx;
                                      setGeneratedQuestions(updated);
                                    }}
                                    className="text-accent"
                                  />
                                  <Input
                                    value={opt}
                                    onChange={(e) => {
                                      const updated = [...generatedQuestions];
                                      updated[qIdx].options[optIdx] = e.target.value;
                                      setGeneratedQuestions(updated);
                                    }}
                                    className="text-xs py-1"
                                  />
                                </div>
                              ))}
                            </div>
                            <Input
                              value={q.explanation || ""}
                              onChange={(e) => {
                                const updated = [...generatedQuestions];
                                updated[qIdx].explanation = e.target.value;
                                setGeneratedQuestions(updated);
                              }}
                              placeholder="Answer explanation"
                              className="text-xs text-muted"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => setAiModalType(null)}
                          className="text-xs text-rose hover:underline"
                        >
                          Reject & Discard
                        </button>
                        <Btn onClick={handleApproveQuestions}>Approve & Add to Question Bank</Btn>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Subject Modal */}
      <AnimatePresence>
        {showNewSubjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl border border-border-2 bg-surface p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border-2 pb-3">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  Create New Subject
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewSubjectModal(false)}
                  className="text-xs text-muted hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateSubject} className="mt-4 space-y-3.5">
                <Field label="Subject Name">
                  <Input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Biochemistry, Anatomy, Zoology"
                    autoFocus
                  />
                </Field>

                <Field label="Description (Optional)">
                  <Input
                    value={newSubjectDesc}
                    onChange={(e) => setNewSubjectDesc(e.target.value)}
                    placeholder="Core syllabus and focus areas"
                  />
                </Field>

                <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-border-2">
                  <Btn
                    variant="ghost"
                    type="button"
                    onClick={() => setShowNewSubjectModal(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Btn>
                  <Btn type="submit" className="text-xs">
                    Save Subject
                  </Btn>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteSubjectConfirmId &&
          (() => {
            const subject = subjects.find((item) => item.id === deleteSubjectConfirmId);
            const noteCount = notes.filter(
              (note) => note.subject_id === deleteSubjectConfirmId,
            ).length;
            if (!subject) return null;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-subject-title"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  className="w-full max-w-md rounded-2xl border border-rose/30 bg-surface p-6 shadow-2xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose/10 text-rose">
                      <Trash2 className="size-4" />
                    </div>
                    <div>
                      <h3
                        id="delete-subject-title"
                        className="text-base font-semibold text-foreground"
                      >
                        Delete {subject.name}?
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {noteCount > 0
                          ? `${noteCount} note${noteCount === 1 ? "" : "s"} will be kept, but moved out of this subject. Chapters and connected syllabus content may be removed.`
                          : "This removes the subject and any connected syllabus content."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                    <Btn
                      variant="ghost"
                      type="button"
                      disabled={isDeletingSubject}
                      onClick={() => setDeleteSubjectConfirmId(null)}
                    >
                      Keep subject
                    </Btn>
                    <Btn
                      variant="danger"
                      type="button"
                      disabled={isDeletingSubject}
                      onClick={handleDeleteSubject}
                    >
                      {isDeletingSubject ? "Deleting…" : "Delete subject"}
                    </Btn>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>
    </AppShell>
  );
}
