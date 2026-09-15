import { supabase } from "@/integrations/supabase/client";

export type Subject = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  created_at: string;
};

export type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  position: number;
};

export type TopicStatus =
  "not_studied" | "studying" | "done" | "not_started" | "in_progress" | "completed";
export type TopicConfidence = "low" | "medium" | "high" | "med";
export type TopicPriority = "low" | "medium" | "high" | "med";

export type Topic = {
  id: string;
  chapter_id: string;
  name: string;
  status?: TopicStatus;
  completion?: "not_started" | "in_progress" | "completed";
  confidence?: TopicConfidence;
  priority?: TopicPriority;
  due_at?: string | null;
  due_review_at?: string | null;
  last_drilled_at?: string | null;
  last_studied_at?: string | null;
  interval_days?: number;
  ease_factor?: number;
  repetitions?: number;
  notes_count?: number;
  mcqs_count?: number;
  tags?: string[];
  created_at?: string;
};

export type Source = {
  id: string;
  chapter_id: string;
  title: string;
  kind: string;
  reference: string | null;
  tags: string[];
};

export type Mcq = {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id?: string | null;
  source_id: string | null;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  notes?: string | null;
  difficulty: string;
  tags: string[];
  status: "approved" | "pending" | "rejected" | "draft" | "archived" | string;
  origin: string;
  is_bookmarked?: boolean;
  created_at: string;
  updated_at?: string;
};

export type NoteCategory = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type Note = {
  id: string;
  user_id?: string;
  title: string;
  content_json?: string;
  plain_text_content: string;
  subject_id: string | null;
  chapter_id: string | null;
  category_id: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  word_count: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  linked_mcq_ids: string[];
};

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewSchedule = {
  id: string;
  user_id?: string;
  mcq_id: string;
  due_at: string;
  last_reviewed_at: string | null;
  last_result: boolean | null;
  review_rating: ReviewRating | null;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
};

export type ReviewEvent = {
  id: string;
  user_id?: string;
  mcq_id: string;
  schedule_id: string;
  rating: ReviewRating;
  is_correct: boolean;
  reviewed_at: string;
  time_spent_seconds: number;
};

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  exam_name: string | null;
  theme: string;
  daily_reminder: boolean;
  reminder_time: string;
  reminder_email: string | null;
};

const unwrap = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
};

export const SUBJECT_COLORS = ["accent", "amber", "rose"] as const;

export const colorClass = (color: string) =>
  color === "amber" ? "bg-amber" : color === "rose" ? "bg-rose" : "bg-accent";

export const colorStroke = (color: string) =>
  color === "amber" ? "var(--amber)" : color === "rose" ? "var(--rose)" : "var(--accent)";

/* ---------- reads ---------- */

export const subjectsQuery = () => ({
  queryKey: ["subjects"],
  queryFn: async () =>
    unwrap<Subject[]>(
      await supabase.from("subjects").select("*").order("position").order("created_at"),
    ),
});

export const chaptersQuery = (subjectId?: string) => ({
  queryKey: ["chapters", subjectId ?? "all"],
  queryFn: async () => {
    let q = supabase.from("chapters").select("*").order("position").order("created_at");
    if (subjectId) q = q.eq("subject_id", subjectId);
    return unwrap<Chapter[]>(await q);
  },
});

export const topicsQuery = (chapterId?: string) => ({
  queryKey: ["topics", chapterId ?? "all"],
  queryFn: async () => {
    let q = supabase.from("topics").select("*").order("name");
    if (chapterId) q = q.eq("chapter_id", chapterId);
    return unwrap<Topic[]>(await q);
  },
});

export const sourcesQuery = (subjectChapterIds?: string[]) => ({
  queryKey: ["sources", subjectChapterIds?.join(",") ?? "all"],
  queryFn: async () => {
    let q = supabase.from("sources").select("*").order("created_at");
    if (subjectChapterIds)
      q = q.in("chapter_id", subjectChapterIds.length ? subjectChapterIds : [""]);
    return unwrap<Source[]>(await q);
  },
});

export const mcqsQuery = (filters?: {
  status?: string;
  subjectId?: string;
  chapterId?: string;
}) => ({
  queryKey: ["mcqs", filters ?? {}],
  queryFn: async () => {
    let q = supabase.from("mcqs").select("*").order("created_at", { ascending: false });
    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.subjectId) q = q.eq("subject_id", filters.subjectId);
    if (filters?.chapterId) q = q.eq("chapter_id", filters.chapterId);
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []).map((row) => ({
      ...row,
      options: Array.isArray(row.options) ? (row.options as string[]) : [],
    })) as Mcq[];
  },
});

export const profileQuery = (userId?: string) => ({
  queryKey: ["profile", userId],
  enabled: !!userId,
  queryFn: async () => {
    const res = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data as Profile | null;
  },
});

export const attemptsQuery = (limit = 500) => ({
  queryKey: ["attempts", limit],
  queryFn: async () =>
    unwrap<
      {
        id: string;
        is_correct?: boolean;
        correct?: boolean;
        created_at: string;
        mode: string;
        mcq_id?: string;
      }[]
    >(
      await supabase
        .from("attempts")
        .select("id,is_correct,created_at,mode,mcq_id")
        .order("created_at", { ascending: false })
        .limit(limit),
    ),
});

export const sessionsQuery = () => ({
  queryKey: ["sessions"],
  queryFn: async () =>
    unwrap<
      {
        id: string;
        mode: string;
        total: number;
        correct: number;
        duration_sec: number;
        created_at: string;
        subject_id: string | null;
      }[]
    >(
      await supabase
        .from("study_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ),
});

export const studySessionsQuery = sessionsQuery;

/* ---------- streaks ---------- */

export function computeStreak(dates: string[]) {
  const days = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  // allow today to be missing without breaking the streak
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------- study plan & exams ---------- */

export type PlanSlot = {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  source_id: string | null;
  weekday: number;
  start_time: string;
  duration_min: number;
  target_questions: number;
  note: string | null;
  done: boolean;
};

export type Exam = {
  id: string;
  name: string;
  exam_date: string | null;
  note: string | null;
  subject_ids: string[];
  chapter_ids: string[];
  created_at: string;
};

export type ExamQuestion = { id: string; exam_id: string; mcq_id: string };

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const planSlotsQuery = () => ({
  queryKey: ["plan-slots"],
  queryFn: async () =>
    unwrap<PlanSlot[]>(
      await supabase.from("study_plan_slots").select("*").order("weekday").order("start_time"),
    ),
});

export const examsQuery = () => ({
  queryKey: ["exams"],
  queryFn: async () =>
    unwrap<Exam[]>(
      await supabase
        .from("exams")
        .select("*")
        .order("exam_date", { ascending: true })
        .order("created_at"),
    ),
});

export const examQuestionsQuery = () => ({
  queryKey: ["exam-questions"],
  queryFn: async () =>
    unwrap<ExamQuestion[]>(await supabase.from("exam_questions").select("id,exam_id,mcq_id")),
});

/* ---------- notes & revision queries ---------- */

export const noteCategoriesQuery = () => ({
  queryKey: ["note-categories"],
  queryFn: async () =>
    unwrap<NoteCategory[]>(await supabase.from("note_categories").select("*").order("position")),
});

export const notesQuery = (filters?: {
  categoryId?: string;
  search?: string;
  pinned?: boolean;
  archived?: boolean;
}) => ({
  queryKey: ["notes", filters ?? {}],
  queryFn: async () => {
    let q = supabase.from("notes").select("*").order("updated_at", { ascending: false });
    if (filters?.categoryId && filters.categoryId !== "all") {
      q = q.eq("category_id", filters.categoryId);
    }
    if (filters?.pinned !== undefined) {
      q = q.eq("is_pinned", filters.pinned);
    }
    if (filters?.archived !== undefined) {
      q = q.eq("is_archived", filters.archived);
    }
    return unwrap<Note[]>(await q);
  },
});

export const reviewSchedulesQuery = () => ({
  queryKey: ["review-schedules"],
  queryFn: async () =>
    unwrap<ReviewSchedule[]>(
      await supabase.from("review_schedules").select("*").order("due_at", { ascending: true }),
    ),
});

export const reviewEventsQuery = () => ({
  queryKey: ["review-events"],
  queryFn: async () =>
    unwrap<ReviewEvent[]>(
      await supabase
        .from("review_events")
        .select("*")
        .order("reviewed_at", { ascending: false })
        .limit(300),
    ),
});
