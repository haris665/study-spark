-- Live learning-workspace tables used by Notes, syllabus topics and spaced repetition.
-- All tables are private to the authenticated learner through RLS.

CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  completion TEXT NOT NULL DEFAULT 'not_started',
  confidence TEXT NOT NULL DEFAULT 'medium',
  priority TEXT NOT NULL DEFAULT 'med',
  due_at TIMESTAMPTZ,
  due_review_at TIMESTAMPTZ,
  last_studied_at TIMESTAMPTZ,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.note_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'accent',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.note_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  plain_text_content TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  word_count INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'accent',
  linked_mcq_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_opened_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.review_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mcq_id UUID NOT NULL REFERENCES public.mcqs(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  last_result BOOLEAN,
  review_rating TEXT,
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mcq_id UUID NOT NULL REFERENCES public.mcqs(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.review_schedules(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0
);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['topics', 'note_categories', 'notes', 'review_schedules', 'review_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "own rows" ON public.%I', table_name);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', table_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS topics_updated ON public.topics;
CREATE TRIGGER topics_updated BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS note_categories_updated ON public.note_categories;
CREATE TRIGGER note_categories_updated BEFORE UPDATE ON public.note_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS notes_updated ON public.notes;
CREATE TRIGGER notes_updated BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS review_schedules_updated ON public.review_schedules;
CREATE TRIGGER review_schedules_updated BEFORE UPDATE ON public.review_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS topics_user_chapter_idx ON public.topics(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON public.notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS review_schedules_user_due_idx ON public.review_schedules(user_id, due_at);
