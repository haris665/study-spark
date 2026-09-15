import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, Plus, RotateCcw, Sparkles, CheckCircle2, Clock, Calendar } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Ring } from "@/components/app/Ring";
import { supabase } from "@/integrations/supabase/client";
import {
  WEEKDAYS,
  chaptersQuery,
  planSlotsQuery,
  sourcesQuery,
  subjectsQuery,
  attemptsQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Study Plan — Study Spark" },
      {
        name: "description",
        content:
          "Map your subjects, chapters and sources onto a weekly study schedule and track how much of each week you have completed.",
      },
      { property: "og:title", content: "Study Plan — Study Spark" },
      {
        property: "og:description",
        content: "A weekly timetable built from your own syllabus, with per-day progress tracking.",
      },
    ],
  }),
  component: PlanPage,
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
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function PlanPage() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery(subjectsQuery());
  const { data: chapters = [] } = useQuery(chaptersQuery());
  const { data: sources = [] } = useQuery(sourcesQuery());
  const { data: slots = [] } = useQuery(planSlotsQuery());
  const { data: attempts = [] } = useQuery(attemptsQuery());

  const [weekday, setWeekday] = useState(0);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [duration, setDuration] = useState(45);
  const [target, setTarget] = useState(20);
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan-slots"] });

  const addSlot = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("study_plan_slots").insert({
        user_id: auth.user.id,
        weekday,
        subject_id: subjectId || null,
        chapter_id: chapterId || null,
        source_id: sourceId || null,
        start_time: `${startTime}:00`,
        duration_min: duration,
        target_questions: target,
        note: note.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNote("");
      invalidate();
      toast.success("Study block added to your weekly plan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("study_plan_slots").update({ done }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_plan_slots").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Study block removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetWeek = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("study_plan_slots")
        .update({ done: false })
        .neq("done", false);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Weekly progress reset");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chapterOptions = useMemo(
    () => (subjectId ? chapters.filter((c) => c.subject_id === subjectId) : chapters),
    [chapters, subjectId],
  );
  const sourceOptions = useMemo(
    () => (chapterId ? sources.filter((s) => s.chapter_id === chapterId) : []),
    [sources, chapterId],
  );

  const subjectOf = (id: string | null) => subjects.find((s) => s.id === id);
  const chapterOf = (id: string | null) => chapters.find((c) => c.id === id);
  const sourceOf = (id: string | null) => sources.find((s) => s.id === id);

  const doneCount = slots.filter((s) => s.done).length;
  const weekMinutes = slots.reduce((n, s) => n + s.duration_min, 0);
  const targetTotal = slots.reduce((n, s) => n + s.target_questions, 0);
  const completion = slots.length ? Math.round((doneCount / slots.length) * 100) : 0;
  const weekAttempts = attempts.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 7 * 24 * 3600 * 1000,
  ).length;

  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <AppShell title="">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto space-y-6 pb-12 text-left"
      >
        {/* Header matching Screenshot */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-slate-100 tracking-tight">
              Study plan
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-normal">
              Your syllabus, mapped onto a week
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="border border-slate-700/80 bg-[#131927] text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium shadow-xs flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cloud synced</span>
            </div>
          </div>
        </motion.div>

        {/* Top Summary Card matching Screenshot */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-slate-800/80 bg-[#131927] p-6 sm:p-7 shadow-2xl relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
            {/* Left Ring */}
            <div className="relative grid place-items-center shrink-0">
              <Ring value={completion} size={90} stroke={7} color="#dca54c" />
              <span className="absolute font-mono text-base font-bold text-slate-100">
                {completion}%
              </span>
            </div>

            {/* Right 3 Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 w-full">
              <div>
                <p className="text-xs font-medium text-slate-400">Blocks done</p>
                <p className="mt-1 text-2xl font-mono font-bold text-slate-100">
                  {doneCount}/{slots.length}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">this week</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">Planned time</p>
                <p className="mt-1 text-2xl font-mono font-bold text-slate-100">
                  {Math.round((weekMinutes / 60) * 10) / 10}h
                </p>
                <p className="mt-0.5 text-xs text-slate-400">across the week</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">Question target</p>
                <p className="mt-1 text-2xl font-mono font-bold text-slate-100">{targetTotal}</p>
                <p className="mt-0.5 text-xs text-slate-400">{weekAttempts} answered in 7 days</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main 2-Column Content Layout matching Screenshot */}
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* LEFT COLUMN: Weekly Days Schedule */}
          <div className="space-y-6">
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-slate-800/80 bg-[#131927] p-6 sm:p-7 shadow-2xl space-y-6"
            >
              {WEEKDAYS.map((day, idx) => {
                const daySlots = slots.filter((s) => s.weekday === idx);
                const isToday = idx === todayIdx;

                return (
                  <motion.div
                    key={day}
                    layout
                    className={`space-y-3 ${
                      idx < WEEKDAYS.length - 1 ? "border-b border-slate-800/80 pb-5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                          {day}
                        </h2>
                        {isToday && (
                          <span className="bg-[#1c2a20] text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-emerald-500/30 uppercase tracking-wide">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        {daySlots.length} blocks
                      </span>
                    </div>

                    {daySlots.length === 0 ? (
                      <p className="text-xs text-slate-400 font-normal">
                        Nothing scheduled — a good day for a timed test.
                      </p>
                    ) : (
                      <div className="space-y-2.5 pt-1">
                        <AnimatePresence>
                          {daySlots.map((slot) => {
                            const subject = subjectOf(slot.subject_id);
                            const chapter = chapterOf(slot.chapter_id);
                            const source = sourceOf(slot.source_id);

                            return (
                              <motion.div
                                key={slot.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#161d2a] p-3.5 shadow-sm"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={slot.done}
                                    onChange={(e) =>
                                      toggleDone.mutate({ id: slot.id, done: e.target.checked })
                                    }
                                    className="mt-1 size-4 rounded accent-amber-500 cursor-pointer"
                                  />
                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs font-bold ${
                                        slot.done ? "line-through text-slate-500" : "text-slate-100"
                                      }`}
                                    >
                                      {subject?.name ?? "General study"}
                                      {chapter && (
                                        <span className="font-normal text-slate-400">
                                          {" "}
                                          · {chapter.name}
                                        </span>
                                      )}
                                    </p>
                                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                                      {slot.start_time.slice(0, 5)} · {slot.duration_min} min ·{" "}
                                      {slot.target_questions} questions
                                      {source ? ` · ${source.title}` : ""}
                                    </p>
                                    {slot.note && (
                                      <p className="mt-1 text-[11px] text-slate-400 italic">
                                        "{slot.note}"
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeSlot.mutate(slot.id)}
                                  className="text-xs text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                  title="Remove study block"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Bottom Dashed Card when 0 weekly blocks exist matching Screenshot */}
            {slots.length === 0 && (
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-dashed border-slate-800/90 bg-[#0d111c] p-8 text-center space-y-1.5"
              >
                <p className="text-sm font-bold text-[#dca54c]">No weekly plan yet</p>
                <p className="text-xs text-slate-400">
                  Add your first study block using the panel on the right.
                </p>
              </motion.div>
            )}
          </div>

          {/* RIGHT COLUMN: Add Study Block Form matching Screenshot */}
          <div className="space-y-6">
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-slate-800/80 bg-[#131927] p-6 shadow-2xl space-y-4 text-left"
            >
              <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                Add a study block
              </h2>

              <div className="space-y-3.5 pt-1">
                {/* Day Field */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 block">Day</label>
                  <select
                    value={weekday}
                    onChange={(e) => setWeekday(Number(e.target.value))}
                    className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-amber-400 cursor-pointer shadow-xs"
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject Field */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 block">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setChapterId("");
                      setSourceId("");
                    }}
                    className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-amber-400 cursor-pointer shadow-xs"
                  >
                    <option value="">Math</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chapter Field */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 block">Chapter</label>
                  <select
                    value={chapterId}
                    onChange={(e) => {
                      setChapterId(e.target.value);
                      setSourceId("");
                    }}
                    className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-amber-400 cursor-pointer shadow-xs"
                  >
                    <option value="">Matics</option>
                    {chapterOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source Field */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 block">Source</label>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-amber-400 cursor-pointer shadow-xs"
                  >
                    <option value="">No specific source</option>
                    {sourceOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3 Inputs Grid: Start, Minutes, Questions */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400 block">Start</label>
                    <input
                      type="text"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs font-mono rounded-xl px-2.5 py-2 text-center focus:outline-none focus:border-amber-400 shadow-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400 block">Minutes</label>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs font-mono rounded-xl px-2.5 py-2 text-center focus:outline-none focus:border-amber-400 shadow-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400 block">
                      Questions
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                      className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs font-mono rounded-xl px-2.5 py-2 text-center focus:outline-none focus:border-amber-400 shadow-xs"
                    />
                  </div>
                </div>

                {/* Note Field */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 block">Note</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional focus for the block"
                    className="w-full bg-[#1c2638] border border-slate-700/80 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-xs"
                  />
                </div>

                {/* Buttons Row matching Screenshot */}
                <div className="flex items-center gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => addSlot.mutate()}
                    disabled={addSlot.isPending}
                    className="bg-[#dca54c] hover:bg-amber-400 text-zinc-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    {addSlot.isPending ? "Adding…" : "Add block"}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => resetWeek.mutate()}
                    disabled={!slots.length}
                    className="bg-[#1c2638] hover:bg-[#253249] text-slate-200 border border-slate-700/80 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Reset week
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
