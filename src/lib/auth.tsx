import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type SyncStatus = "connected" | "offline" | "guest";

export type AuthUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  isGuest?: boolean;
  user_metadata?: { display_name?: string; avatar_url?: string | null };
};

type AuthResult = {
  user: SupabaseUser | null;
  error: string | null;
  redirected?: boolean;
  requiresEmailConfirmation?: boolean;
};

export const DEMO_USER: AuthUser = {
  id: "local-user-1",
  email: "student@studyspark.app",
  displayName: "Offline Student",
  isGuest: true,
};

type AuthState = {
  user: AuthUser;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  syncStatus: SyncStatus;
  retrySync: () => Promise<boolean>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithEmail: (email: string, pass: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error: string | null }>;
  deleteAccount: () => Promise<{ ok: boolean; error: string | null }>;
  continueOffline: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: DEMO_USER,
  supabaseUser: null,
  loading: false,
  syncStatus: "guest",
  retrySync: async () => false,
  signInWithGoogle: async () => ({ user: null, error: "Not ready" }),
  signInWithEmail: async () => ({ user: null, error: "Not ready" }),
  signUpWithEmail: async () => ({ user: null, error: "Not ready" }),
  resetPassword: async () => ({ ok: false, error: "Not ready" }),
  deleteAccount: async () => ({ ok: false, error: "Not ready" }),
  continueOffline: () => {},
  signOut: async () => {},
});

const toAuthUser = (account: SupabaseUser): AuthUser => {
  const metadata = account.user_metadata as Record<string, unknown>;
  const displayName =
    (typeof metadata["display_name"] === "string" && metadata["display_name"]) ||
    (typeof metadata["full_name"] === "string" && metadata["full_name"]) ||
    account.email?.split("@")[0] ||
    "Student";
  const avatar = typeof metadata["avatar_url"] === "string" ? metadata["avatar_url"] : null;
  return {
    id: account.id,
    email: account.email ?? null,
    displayName,
    photoURL: avatar,
    isGuest: false,
    user_metadata: { display_name: displayName, avatar_url: avatar },
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(DEMO_USER);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? "guest" : "offline",
  );

  const applyAccount = (account: SupabaseUser | null) => {
    setSupabaseUser(account);
    setUser(account ? toAuthUser(account) : DEMO_USER);
    setSyncStatus(account ? "connected" : isSupabaseConfigured ? "guest" : "offline");
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }: any) => {
      if (!alive) return;
      if (error) setSyncStatus("offline");
      else applyAccount(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (alive) applyAccount(session?.user ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const retrySync = async () => {
    if (!isSupabaseConfigured) return false;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setSyncStatus("offline");
      return false;
    }
    applyAccount(data.session?.user ?? null);
    return true;
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured || !supabase.auth.signInWithOAuth) {
      return {
        user: null,
        error: "Google sign-in needs Supabase URL, anon key, and the Google provider enabled.",
      };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/auth`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    return {
      user: data.user ?? null,
      error: error?.message ?? null,
      redirected: Boolean(data.url),
    };
  };

  const signInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.user) applyAccount(data.user);
    return { user: data.user ?? null, error: error?.message ?? null };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name || email.split("@")[0] } },
    });
    if (data.session?.user) applyAccount(data.session.user);
    return {
      user: data.user ?? null,
      error: error?.message ?? null,
      requiresEmailConfirmation: Boolean(data.user && !data.session),
    };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/auth`,
    });
    return { ok: !error, error: error?.message ?? null };
  };

  const deleteAccount = async () => ({
    ok: false,
    error: "Account deletion must be enabled through a secure Supabase server-side endpoint.",
  });

  const continueOffline = () => applyAccount(null);
  const signOut = async () => {
    await supabase.auth.signOut();
    applyAccount(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        loading,
        syncStatus,
        retrySync,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        deleteAccount,
        continueOffline,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
