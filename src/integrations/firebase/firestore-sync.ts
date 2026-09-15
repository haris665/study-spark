import { db, doc, setDoc, deleteDoc, collection, getDocs } from "./firebase";
import type { Note, Subject, Attempt } from "@/lib/queries";

/**
 * Persist or update a note in Cloud Firestore
 */
export async function saveNoteToFirestore(userId: string, note: Partial<Note> & { id: string }) {
  try {
    const noteRef = doc(db, "users", userId, "notes", note.id);
    await setDoc(
      noteRef,
      {
        id: note.id,
        userId,
        subjectId: note.subject_id ?? null,
        chapterId: note.chapter_id ?? null,
        title: note.title ?? "Untitled Note",
        plainTextContent: note.plain_text_content ?? "",
        isPinned: Boolean(note.is_pinned),
        color: note.color ?? "accent",
        createdAt: note.created_at ?? new Date().toISOString(),
        updatedAt: note.updated_at ?? new Date().toISOString(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("Failed to save note to Firestore:", err);
    return false;
  }
}

/**
 * Delete a note from Cloud Firestore
 */
export async function deleteNoteFromFirestore(userId: string, noteId: string) {
  try {
    const noteRef = doc(db, "users", userId, "notes", noteId);
    await deleteDoc(noteRef);
    return true;
  } catch (err) {
    console.error("Failed to delete note from Firestore:", err);
    return false;
  }
}

/**
 * Save a subject to Cloud Firestore
 */
export async function saveSubjectToFirestore(
  userId: string,
  subject: Partial<Subject> & { id: string },
) {
  try {
    const subRef = doc(db, "users", userId, "subjects", subject.id);
    await setDoc(
      subRef,
      {
        id: subject.id,
        userId,
        name: subject.name ?? "New Subject",
        description: subject.description ?? null,
        color: subject.color ?? "accent",
        position: subject.position ?? 0,
        createdAt: subject.created_at ?? new Date().toISOString(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("Failed to save subject to Firestore:", err);
    return false;
  }
}

/** Delete a subject mirror after it has been removed from the primary data store. */
export async function deleteSubjectFromFirestore(userId: string, subjectId: string) {
  try {
    const subjectRef = doc(db, "users", userId, "subjects", subjectId);
    await deleteDoc(subjectRef);
    return true;
  } catch (err) {
    console.error("Failed to delete subject from Firestore:", err);
    return false;
  }
}

/**
 * Save an MCQ attempt record to Cloud Firestore
 */
export async function saveAttemptToFirestore(
  userId: string,
  attempt: {
    id?: string;
    mcq_id: string;
    selected_index?: number;
    chosen_index?: number;
    is_correct?: boolean;
    correct?: boolean;
    time_spent_sec?: number;
    duration_ms?: number;
    created_at?: string;
  },
) {
  try {
    const attemptId = attempt.id || crypto.randomUUID();
    const attRef = doc(db, "users", userId, "attempts", attemptId);
    await setDoc(
      attRef,
      {
        id: attemptId,
        userId,
        mcqId: attempt.mcq_id,
        selectedIndex: attempt.selected_index ?? attempt.chosen_index ?? 0,
        isCorrect: attempt.is_correct ?? attempt.correct ?? false,
        timeSpentSec:
          attempt.time_spent_sec ??
          (attempt.duration_ms ? Math.round(attempt.duration_ms / 1000) : 0),
        createdAt: attempt.created_at ?? new Date().toISOString(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("Failed to save attempt to Firestore:", err);
    return false;
  }
}

/**
 * Load all notes from Cloud Firestore for a user
 */
export async function loadNotesFromFirestore(userId: string): Promise<Note[]> {
  try {
    const notesCol = collection(db, "users", userId, "notes");
    const snapshot = await getDocs(notesCol);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id || docSnap.id,
        user_id: userId,
        subject_id: data.subjectId ?? null,
        chapter_id: data.chapterId ?? null,
        category_id: null,
        title: data.title || "Untitled",
        content: {},
        plain_text_content: data.plainTextContent || "",
        is_pinned: Boolean(data.isPinned),
        color: data.color || "accent",
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
        last_opened_at: null,
      };
    });
  } catch (err) {
    console.warn("Could not load notes from Firestore:", err);
    return [];
  }
}
