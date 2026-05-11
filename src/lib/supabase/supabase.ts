import {
  clearSession,
  setSession,
  setUserData,
} from "@/redux/slices/user-data";
import { store } from "@/redux/store";
import { MajikUser } from "@thezelijah/majik-user";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createSupabaseBrowserClient = (): SupabaseClient<
  any,
  any,
  "majikah",
  any,
  any
> => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: {
      schema: "majikah",
    },
    global: {
      headers: {
        "X-API-KEY": import.meta.env.VITE_API_KEY, // optional extra API key
      },
    },
  });
};

export const refreshSupabaseAccessToken = async (): Promise<string | null> => {
  const supabase = createSupabaseBrowserClient();

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (
    !sessionData ||
    !userData ||
    !sessionData?.session ||
    !userData?.user ||
    sessionError ||
    userError
  ) {
    console.log("No current user found. Session expired.", {
      sessionError,
      userError,
    });

    toast.error(
      "Your session has expired due to inactivity. Please log in again to continue using our services.",
    );

    store.dispatch(clearSession());

    return null;
  }

  const parsedUser = MajikUser.fromSupabase(userData.user).toJSON();

  store.dispatch(setSession(sessionData.session));
  store.dispatch(setUserData(parsedUser));
  return sessionData.session.access_token;
};
