import { localStore } from "@/lib/local-store";

type FilterFn = (item: Record<string, unknown>) => boolean;

export interface LocalQueryBuilder<T = unknown> {
  select: (_cols?: string) => LocalQueryBuilder<T>;
  order: (_col?: string, _opts?: { ascending?: boolean }) => LocalQueryBuilder<T>;
  limit: (_n?: number) => LocalQueryBuilder<T>;
  eq: (column: string, value: unknown) => LocalQueryBuilder<T>;
  neq: (column: string, value: unknown) => LocalQueryBuilder<T>;
  in: (column: string, values: unknown[]) => LocalQueryBuilder<T>;
  single: () => LocalQueryBuilder<T>;
  maybeSingle: () => LocalQueryBuilder<T>;
  insert: (values: unknown) => Promise<{ data: unknown; error: null }>;
  update: (patch: Record<string, unknown>) => {
    eq: (column: string, value: unknown) => Promise<{ data: unknown; error: null }>;
    neq: (column: string, value: unknown) => Promise<{ data: unknown; error: null }>;
  };
  delete: () => {
    eq: (col: string, val: unknown) => unknown;
    match: (obj: Record<string, unknown>) => unknown;
    then: (resolve: (val: { data: null; error: null }) => void) => void;
  };
  then: <TResult1 = { data: T; error: null }>(
    resolve?: ((value: { data: T; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => unknown) | null,
  ) => Promise<TResult1>;
}

export function createLocalQueryBuilder(table: string): LocalQueryBuilder {
  const filters: FilterFn[] = [];
  let isSingle = false;
  let isMaybeSingle = false;

  const builder: LocalQueryBuilder = {
    select: (_cols?: string) => builder,
    order: (_col?: string, _opts?: { ascending?: boolean }) => builder,
    limit: (_n?: number) => builder,
    eq: (column: string, value: unknown) => {
      filters.push((item) => String(item[column]) === String(value));
      return builder;
    },
    neq: (column: string, value: unknown) => {
      filters.push((item) => String(item[column]) !== String(value));
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      const set = new Set(values.map((v) => String(v)));
      filters.push((item) => set.has(String(item[column])));
      return builder;
    },
    single: () => {
      isSingle = true;
      return builder;
    },
    maybeSingle: () => {
      isMaybeSingle = true;
      return builder;
    },
    insert: async (values: unknown) => {
      const rows = Array.isArray(values) ? values : [values];
      let created: unknown[] = [];
      if (table === "subjects") {
        created = rows.map((r) => localStore.addSubject(r as never));
      } else if (table === "chapters") {
        created = rows.map((r) => localStore.addChapter(r as never));
      } else if (table === "topics") {
        created = rows.map((r) => localStore.addTopic(r as never));
      } else if (table === "sources") {
        created = rows.map((r) => localStore.addSource(r as never));
      } else if (table === "mcqs") {
        created = localStore.addMcqs(rows as never);
      } else if (table === "attempts") {
        created = rows.map((r) => {
          const row = r as Record<string, unknown>;
          return localStore.addAttempt({
            ...row,
            is_correct: Boolean(row["is_correct"] ?? row["correct"]),
            mode: String(row["mode"] ?? row["kind"] ?? "practice"),
          } as never);
        });
      } else if (table === "study_sessions" || table === "sessions") {
        created = rows.map((r) => {
          const row = r as Record<string, unknown>;
          return localStore.addSession({
            ...row,
            mode: String(row["mode"] ?? row["kind"] ?? "practice"),
            total: Number(row["total"] ?? row["total_questions"] ?? 0),
            correct: Number(row["correct"] ?? row["correct_questions"] ?? 0),
            duration_sec: Number(row["duration_sec"] ?? row["duration_seconds"] ?? 0),
            subject_id: (row["subject_id"] as string | null) ?? null,
          });
        });
      } else if (table === "study_plan_slots") {
        created = rows.map((r) => localStore.addPlanSlot(r as never));
      } else if (table === "exams") {
        created = rows.map((r) => localStore.addExam(r as never));
      } else if (table === "exam_questions") {
        created = rows.map((r) => localStore.addExamQuestion(r as never));
      } else if (table === "notes") {
        created = rows.map((r) => localStore.addNote(r as never));
      } else if (table === "note_categories") {
        created = rows.map((r) => localStore.addNoteCategory(r as never));
      } else if (table === "review_schedules") {
        created = rows.map((r) => localStore.addReviewSchedule(r as never));
      } else if (table === "review_events") {
        created = rows.map((r) => localStore.addReviewEvent(r as never));
      }
      return { data: Array.isArray(values) ? created : created[0], error: null };
    },
    update: (patch: Record<string, unknown>) => {
      const applyUpdate = async (column: string, value: unknown, exclude = false) => {
        if (exclude && table === "study_plan_slots") {
          const slots = localStore.getPlanSlots().map((slot) =>
            String((slot as Record<string, unknown>)[column]) !== String(value)
              ? { ...slot, ...patch }
              : slot,
          );
          localStore.savePlanSlots(slots);
          return { data: slots, error: null };
        }
          if (column === "id" || column === "user_id") {
            const id = String(value);
            if (table === "profiles") {
              const updated = localStore.updateProfile(patch);
              return { data: updated, error: null };
            } else if (table === "subjects") {
              const updated = localStore.updateSubject(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "chapters") {
              const updated = localStore.updateChapter(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "topics") {
              const updated = localStore.updateTopic(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "mcqs") {
              const updated = localStore.updateMcq(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "sources") {
              const updated = localStore.updateSource(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "study_plan_slots") {
              const updated = localStore.updatePlanSlot(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "notes") {
              const updated = localStore.updateNote(id, patch as never);
              return { data: updated, error: null };
            } else if (table === "review_schedules") {
              const updated = localStore.updateReviewSchedule(id, patch as never);
              return { data: updated, error: null };
            }
          }
          return { data: null, error: null };
      };
      return {
        eq: (column: string, value: unknown) => applyUpdate(column, value),
        neq: (column: string, value: unknown) => applyUpdate(column, value, true),
      };
    },
    delete: () => {
      const executeDelete = (col: string, val: unknown) => {
        const id = String(val);
        if (table === "subjects") localStore.deleteSubject(id);
        else if (table === "chapters") localStore.deleteChapter(id);
        else if (table === "topics") {
          if (col === "chapter_id") {
            const remaining = localStore.getTopics().filter((t) => t.chapter_id !== id);
            localStore.saveTopics(remaining);
          } else {
            localStore.deleteTopic(id);
          }
        } else if (table === "sources") localStore.deleteSource(id);
        else if (table === "mcqs") localStore.deleteMcq(id);
        else if (table === "study_plan_slots") localStore.deletePlanSlot(id);
        else if (table === "exams") localStore.deleteExam(id);
        else if (table === "notes") localStore.deleteNote(id);
        else if (table === "note_categories") localStore.deleteNoteCategory(id);
        else if (table === "review_schedules") localStore.deleteReviewSchedule(id);
        else if (table === "exam_questions") {
          const all = localStore.getExamQuestions();
          const filtered = all.filter((q) => String(q[col as keyof typeof q]) !== id);
          localStore.saveExamQuestions(filtered);
        }
      };

      const deleteFilters: Array<[string, unknown]> = [];
      const execute = () => {
        if (table === "exam_questions") {
          const remaining = localStore.getExamQuestions().filter((row) =>
            !deleteFilters.every(([key, value]) =>
              String(row[key as keyof typeof row]) === String(value),
            ),
          );
          localStore.saveExamQuestions(remaining);
        } else {
          deleteFilters.forEach(([column, value]) => executeDelete(column, value));
        }
      };
      const chain: {
        eq: (col: string, val: unknown) => typeof chain;
        match: (obj: Record<string, unknown>) => typeof chain;
        then: (resolve: (val: { data: null; error: null }) => void) => void;
      } = {
        eq: (col: string, val: unknown) => {
          deleteFilters.push([col, val]);
          return chain;
        },
        match: (obj: Record<string, unknown>) => {
          deleteFilters.push(...Object.entries(obj));
          return chain;
        },
        then: (resolve: (val: { data: null; error: null }) => void) => {
          execute();
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    then: (resolve: (val: unknown) => void, reject?: (reason: unknown) => void) => {
      try {
        let list: Record<string, unknown>[] = [];
        if (table === "subjects") {
          list = localStore.getSubjects() as never[];
        } else if (table === "chapters") {
          list = localStore.getChapters() as never[];
        } else if (table === "topics") {
          list = localStore.getTopics() as never[];
        } else if (table === "sources") {
          list = localStore.getSources() as never[];
        } else if (table === "mcqs") {
          list = localStore.getMcqs() as never[];
        } else if (table === "attempts") {
          list = localStore.getAttempts() as never[];
        } else if (table === "study_sessions") {
          list = localStore.getSessions() as never[];
        } else if (table === "profiles") {
          const p = localStore.getProfile();
          list = p ? [p as never] : [];
        } else if (table === "study_plan_slots") {
          list = localStore.getPlanSlots() as never[];
        } else if (table === "exams") {
          list = localStore.getExams() as never[];
        } else if (table === "exam_questions") {
          list = localStore.getExamQuestions() as never[];
        } else if (table === "notes") {
          list = localStore.getNotes() as never[];
        } else if (table === "note_categories") {
          list = localStore.getNoteCategories() as never[];
        } else if (table === "review_schedules") {
          list = localStore.getReviewSchedules() as never[];
        } else if (table === "review_events") {
          list = localStore.getReviewEvents() as never[];
        }

        // Apply filters
        for (const fn of filters) {
          list = list.filter(fn);
        }

        if (isSingle) {
          resolve({ data: list[0] ?? null, error: list[0] ? null : { message: "Not found" } });
        } else if (isMaybeSingle) {
          resolve({ data: list[0] ?? null, error: null });
        } else {
          resolve({ data: list, error: null });
        }
      } catch (err) {
        if (reject) reject(err);
        else resolve({ data: null, error: { message: String(err) } });
      }
    },
  };

  return builder;
}
