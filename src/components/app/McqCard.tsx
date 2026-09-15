import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  BookOpen,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Tag,
} from "lucide-react";
import type { Mcq, Source } from "@/lib/queries";

interface McqCardProps {
  mcq: Mcq;
  sources: Source[];
  viewMode: "compact" | "formatted";
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  chapterId?: string | undefined;
  index?: number | undefined;
}

export function McqCard({
  mcq,
  sources,
  viewMode,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  chapterId,
  index,
}: McqCardProps) {
  const options = Array.isArray(mcq.options) ? mcq.options : [];
  const correctIdx = typeof mcq.correct_index === "number" ? mcq.correct_index : 0;
  const correctOptionText = options[correctIdx] ?? "Not specified";
  const linkedSource = sources.find((s) => s.id === mcq.source_id);

  // Live interactive trial state on the card
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const showFormatted = viewMode === "formatted" || isExpanded;

  const statusTone =
    mcq.status === "approved"
      ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/60"
      : mcq.status === "draft"
        ? "text-amber-400 bg-amber-950/60 border-amber-800/60"
        : "text-sky-400 bg-sky-950/60 border-sky-800/60";

  const diffTone =
    mcq.difficulty === "easy"
      ? "text-emerald-400 bg-emerald-950/50 border-emerald-800/50"
      : mcq.difficulty === "hard"
        ? "text-rose-400 bg-rose-950/50 border-rose-800/50"
        : "text-amber-400 bg-amber-950/50 border-amber-800/50";

  const handleOptionClick = (idx: number) => {
    setSelectedAnswer(idx);
    setShowExplanation(true);
  };

  const handleCopyQuestion = () => {
    const formattedText = `Q: ${mcq.question}\n${options
      .map(
        (opt, i) => `${String.fromCharCode(65 + i)}) ${opt}${i === correctIdx ? " (Correct)" : ""}`,
      )
      .join("\n")}${mcq.explanation ? `\n\nExplanation: ${mcq.explanation}` : ""}`;
    navigator.clipboard.writeText(formattedText);
    toast.success("Question & options copied to clipboard");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="group relative flex w-full flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 hover:bg-surface p-4 sm:p-6 transition-all duration-200 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-950/15"
    >
      <div className="space-y-4">
        {/* Top Header Row: Badges on Left, Actions on Right */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
          {/* Badges and metadata */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {typeof index === "number" && (
              <span className="inline-flex items-center rounded-lg bg-teal-400/10 px-2.5 py-1 font-mono text-xs font-bold text-teal-300 border border-teal-500/30 shadow-2xs">
                Q{String(index).padStart(2, "0")}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border ${statusTone}`}
            >
              <span className="size-1.5 rounded-full bg-current opacity-80" />
              {mcq.status || "approved"}
            </span>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border ${diffTone}`}
            >
              {mcq.difficulty || "medium"}
            </span>
            {linkedSource && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-0.5 text-[10px] font-mono text-muted border border-border/60 max-w-[200px] truncate">
                <BookOpen className="size-3 text-teal-400 shrink-0" />
                <span className="truncate">{linkedSource.title}</span>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {viewMode === "compact" && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-mono font-medium text-teal-400 hover:text-teal-300 hover:bg-surface-2/80 transition-colors cursor-pointer border border-border/60"
                title={isExpanded ? "Collapse formatted view" : "Expand to view all 4 options"}
              >
                <span>{isExpanded ? "Collapse" : "View formatted"}</span>
                {isExpanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyQuestion}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground transition-colors cursor-pointer"
              title="Copy Question & Options"
              aria-label="Copy Question & Options"
            >
              <Copy className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-1.5 text-muted hover:bg-teal-500/10 hover:text-teal-400 transition-colors cursor-pointer"
              title="Edit Question"
              aria-label="Edit Question"
            >
              <Edit2 className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-muted hover:bg-rose-950/50 hover:text-rose transition-colors cursor-pointer"
              title="Delete Question"
              aria-label="Delete Question"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Question Statement */}
        <div className="space-y-2">
          <h3 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed select-text">
            {mcq.question}
          </h3>

          {/* Compact View: Wide, Elegant Answer Bar */}
          {!showFormatted && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 sm:px-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/25 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40">
                  {String.fromCharCode(65 + correctIdx)}
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    ANSWER:
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-emerald-100">
                    {correctOptionText}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
              >
                <span>Show 4 Options</span>
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Formatted View: 4 Options Grid (Full Width & Balanced) */}
        <AnimatePresence>
          {showFormatted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3 pt-1"
            >
              {/* Option Choice Grid (2 Columns on Tablet/Desktop, 1 Col on Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isCorrect = idx === correctIdx;
                  const isUserPicked = selectedAnswer === idx;

                  let cardStyle =
                    "border-border/70 bg-surface-2/40 text-foreground hover:border-teal-500/40 hover:bg-surface-2/80";
                  let medallionStyle = "bg-surface-2 text-muted border-border/80";

                  if (isCorrect) {
                    cardStyle =
                      "border-emerald-500/60 bg-emerald-950/30 text-emerald-100 ring-1 ring-emerald-500/40 font-medium";
                    medallionStyle =
                      "bg-emerald-500/30 text-emerald-300 border-emerald-500/60 shadow-2xs";
                  } else if (isUserPicked && !isCorrect) {
                    cardStyle =
                      "border-rose-500/60 bg-rose-950/30 text-rose-200 ring-1 ring-rose-500/40";
                    medallionStyle = "bg-rose-500/30 text-rose-300 border-rose-500/60 shadow-2xs";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOptionClick(idx)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-xs sm:text-sm text-left transition-all duration-150 cursor-pointer ${cardStyle}`}
                    >
                      <span
                        className={`size-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border mt-0.5 ${medallionStyle}`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 min-w-0 leading-relaxed">{opt}</span>
                      {isCorrect && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/60 border border-emerald-600/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 shrink-0">
                          <CheckCircle2 className="size-3" /> Correct
                        </span>
                      )}
                      {isUserPicked && !isCorrect && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-900/60 border border-rose-600/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-300 shrink-0">
                          <XCircle className="size-3" /> Picked
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation & Textbook Reasoning Drawer */}
              {(mcq.explanation || showExplanation) && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3.5 text-xs text-muted leading-relaxed space-y-1.5"
                >
                  <div className="flex items-center gap-2 font-semibold text-teal-300 font-mono text-[11px] uppercase tracking-wider">
                    <Sparkles className="size-3.5 text-teal-400" />
                    <span>Explanation & Textbook Context</span>
                  </div>
                  <p className="text-foreground/90 font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    {mcq.explanation ||
                      "Correct choice is verified from syllabus learning materials and verified answers."}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card Footer: Metadata (Sources, Tags) + Action Button */}
      <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {linkedSource && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-mono text-teal-300 border border-border/60">
              <BookOpen className="size-3 text-teal-400" />
              <span className="font-semibold">{linkedSource.title}</span>
              {linkedSource.reference ? (
                <span className="text-muted">({linkedSource.reference})</span>
              ) : null}
            </span>
          )}
          {(mcq.tags || []).map((tag, tIdx) => (
            <span
              key={tIdx}
              className="inline-flex items-center gap-1 rounded-md bg-surface-2/80 px-2 py-0.5 text-[10px] font-mono text-faint border border-border/40"
            >
              <Tag className="size-2.5 text-faint" />
              {tag.replace(/^#/, "")}
            </span>
          ))}
        </div>

        {chapterId && (
          <Link
            to="/practice"
            search={{ chapterId }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-400/10 hover:bg-teal-400/20 text-teal-300 border border-teal-500/30 px-3 py-1.5 text-xs font-semibold transition-all active:scale-98 shadow-2xs"
          >
            <Play className="size-3.5 text-teal-400" />
            <span>Practice Chapter</span>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
