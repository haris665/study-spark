import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, HelpCircle, Sparkles } from "lucide-react";
import { Btn, Field, Input, Textarea, Select } from "@/components/app/kit";
import type { Mcq, Source } from "@/lib/queries";

interface McqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    difficulty: string;
    source_id: string | null;
    tags: string[];
    status: string;
  }) => void | Promise<void>;
  initialMcq?: Mcq | null | undefined;
  sources: Source[];
  chapterName?: string | undefined;
}

export function McqModal({
  isOpen,
  onClose,
  onSave,
  initialMcq,
  sources,
  chapterName,
}: McqModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [sourceId, setSourceId] = useState<string>("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("approved");

  useEffect(() => {
    if (initialMcq) {
      setQuestion(initialMcq.question || "");
      const currentOpts = Array.isArray(initialMcq.options) ? [...initialMcq.options] : [];
      while (currentOpts.length < 4) currentOpts.push("");
      setOptions([
        currentOpts[0] || "",
        currentOpts[1] || "",
        currentOpts[2] || "",
        currentOpts[3] || "",
      ]);
      setCorrectIndex(typeof initialMcq.correct_index === "number" ? initialMcq.correct_index : 0);
      setExplanation(initialMcq.explanation || "");
      setDifficulty(initialMcq.difficulty || "medium");
      setSourceId(initialMcq.source_id || "");
      setTags((initialMcq.tags || []).join(", "));
      setStatus(initialMcq.status || "approved");
    } else {
      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      setExplanation("");
      setDifficulty("medium");
      setSourceId(sources[0]?.id || "");
      setTags("");
      setStatus("approved");
    }
  }, [initialMcq, isOpen, sources]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const finalOptions = options.map(
      (opt, i) => opt.trim() || `Option ${String.fromCharCode(65 + i)}`,
    );
    const tagsArray = tags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    onSave({
      question: question.trim(),
      options: finalOptions,
      correct_index: correctIndex,
      explanation: explanation.trim(),
      difficulty,
      source_id: sourceId || null,
      tags: tagsArray,
      status,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {initialMcq ? "Edit Multiple Choice Question" : "Create New MCQ"}
                </h2>
                <p className="text-xs text-muted">
                  {chapterName ? `In ${chapterName}` : "Add question to syllabus bank"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground cursor-pointer"
                title="Close dialog"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Question Statement */}
              <Field label="Question Statement">
                <Textarea
                  rows={3}
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. In the play 'A Visit to a Small Planet,' what shape was Kreton's spaceship?"
                  className="text-xs font-sans"
                />
              </Field>

              {/* 4 Choices with Correct Answer Radio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    Options & Correct Answer (Select the radio of the correct choice)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-medium">
                    Correct: Option {String.fromCharCode(65 + correctIndex)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isCorrect = correctIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setCorrectIndex(idx)}
                        className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer ${
                          isCorrect
                            ? "border-emerald-500/60 bg-emerald-950/25 ring-1 ring-emerald-500/30"
                            : "border-border/60 bg-surface-2/40 hover:border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="correct_option_radio"
                          checked={isCorrect}
                          onChange={() => setCorrectIndex(idx)}
                          className="size-3.5 accent-teal-400 shrink-0 cursor-pointer"
                        />
                        <span className="font-mono font-bold text-xs text-muted w-4 shrink-0">
                          {letter}:
                        </span>
                        <input
                          type="text"
                          required={idx < 2}
                          value={opt}
                          onChange={(e) => {
                            const next = [...options] as [string, string, string, string];
                            next[idx] = e.target.value;
                            setOptions(next);
                          }}
                          placeholder={`Choice ${letter}`}
                          className="w-full bg-transparent text-xs text-foreground placeholder:text-faint focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation Field */}
              <Field label="Explanation & Textbook Reference">
                <Textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Provide conceptual justification or reference page numbers..."
                  className="text-xs font-sans"
                />
              </Field>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Difficulty">
                  <Select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="text-xs"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </Field>

                <Field label="Reference Source">
                  <Select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="text-xs"
                  >
                    <option value="">None (Chapter Level)</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Review Status">
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="text-xs"
                  >
                    <option value="approved">Approved</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                  </Select>
                </Field>
              </div>

              {/* Tags Field */}
              <Field label="Tags, comma separated">
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. quaid-e-azam-speech, literature, drama"
                  className="text-xs font-mono"
                />
              </Field>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <Btn type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Btn>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-400 hover:bg-teal-300 text-teal-950 font-semibold text-xs py-2 px-4 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  {initialMcq ? "Save MCQ Changes" : "Add MCQ to Chapter"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
