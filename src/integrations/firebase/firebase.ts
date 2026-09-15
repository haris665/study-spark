import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  deleteUser as firebaseDeleteUser,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import firebaseConfig from "../../../firebase-applet-config.json";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with persistent local session
export const auth = getAuth(app);
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase Auth persistence configuration warning:", err);
  });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Structured Firestore Error Handler per Firebase skill guidelines
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.warn("Firestore Operation Notice:", JSON.stringify(errInfo));
  return errInfo;
}

// Initialize Cloud Firestore using the provisioned database ID
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connection test per Firebase skill
export async function testConnection(): Promise<{ ok: boolean; status: string }> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return { ok: true, status: "connected" };
  } catch (error) {
    const isOffline = error instanceof Error && error.message.includes("the client is offline");
    if (isOffline) {
      console.warn("Firestore client is offline. Local persistence active.");
      return { ok: false, status: "offline" };
    }
    return { ok: false, status: "unreachable" };
  }
}

// Check connection status without throwing
export async function checkConnectionStatus(): Promise<boolean> {
  const res = await testConnection();
  return res.ok;
}

// Google Sign In helper
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    // Persist user profile to Firestore
    await setDoc(
      doc(db, "users", user.uid),
      {
        id: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "Student",
        photoURL: user.photoURL ?? "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return { user, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    return { user: null, error: message };
  }
}

// Email/Password helpers
export async function signInWithEmail(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return { user: result.user, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sign in failed";
    return { user: null, error: message };
  }
}

export async function signUpWithEmail(email: string, pass: string, name?: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const user = result.user;
    await setDoc(
      doc(db, "users", user.uid),
      {
        id: user.uid,
        email: user.email ?? "",
        displayName: name || user.email?.split("@")[0] || "Student",
        photoURL: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return { user, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sign up failed";
    return { user: null, error: message };
  }
}

export async function sendPasswordReset(email: string) {
  try {
    await firebaseSendPasswordReset(auth, email);
    return { ok: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send password reset email";
    return { ok: false, error: message };
  }
}

export async function deleteCurrentUser() {
  try {
    const current = auth.currentUser;
    if (current) {
      // Delete user document in Firestore
      try {
        await deleteDoc(doc(db, "users", current.uid));
      } catch (e) {
        console.warn("User firestore doc delete warning:", e);
      }
      await firebaseDeleteUser(current);
    }
    return { ok: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete account";
    return { ok: false, error: message };
  }
}

export async function signOutUser() {
  await firebaseSignOut(auth);
}

export {
  app,
  onAuthStateChanged,
  type FirebaseUser,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
};
