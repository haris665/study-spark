import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "github", opts?: SignInOptions) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: opts?.redirect_uri ?? window.location.origin,
            queryParams: opts?.extraParams,
          },
        });
        if (error) return { error };
        return { data, redirected: !!data?.url };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};
