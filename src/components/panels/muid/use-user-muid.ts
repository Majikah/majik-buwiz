/**
 * hooks/useUserMUID.ts
 *
 * Owns ALL async MUID state:
 *   - fetch with generation-counter race guard
 *   - Supabase realtime subscription
 *   - auth sign-in / sign-out listeners
 *
 * Returns stable references so consumers don't need to re-subscribe
 * when unrelated state changes.
 *
 * ── Race condition fix ──────────────────────────────────────────────────────
 * The original used a single boolean `cancelled` flag + `refreshTick` in
 * the same dependency array as `majikah?.user?.id`.  On auth change both
 * the `sign-in` event handler (→ setRefreshTick) and the user-id dep change
 * fired near-simultaneously, spawning two concurrent fetches.  The `cancelled`
 * flag only protected against the *previous* effect invocation; it did not
 * prevent two effects that started in the same render cycle from both
 * calling setUID.
 *
 * Fix: use a monotonically-increasing `fetchGenRef` (ref, not state).
 * Each fetch captures its own generation number at start.  Only the fetch
 * whose generation matches the *current* ref value is allowed to commit
 * state.  Any earlier, stale fetch is silently discarded.
 *
 * Additionally, `refreshTick` has been separated from `majikah?.user?.id`
 * so that manual refreshes don't compound with auth-triggered ones.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MajikUniversalID,
  type MajikUniversalIDJSON,
  type PrivatePersonalInfo,
} from "@majikah/majik-universal-id";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { SupabaseRealtime } from "@/lib/supabase/supabase-realtime";
import { useMajikah } from "@/components/majikah-session-wrapper/use-majikah";

export interface UseMUIDReturn {
  uid: MajikUniversalID | null;
  privateInfo: PrivatePersonalInfo | null;
  muidLoading: boolean;
  sessionStatus: string | null;
  verificationUrl: string | null;
  showSetupAfterDelete: boolean;

  // actions
  setUID: React.Dispatch<React.SetStateAction<MajikUniversalID | null>>;
  setPrivateInfo: React.Dispatch<
    React.SetStateAction<PrivatePersonalInfo | null>
  >;
  setSessionStatus: React.Dispatch<React.SetStateAction<string | null>>;
  setVerificationUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setShowSetupAfterDelete: React.Dispatch<React.SetStateAction<boolean>>;
  refresh: () => void;
}

export function useUserMUID(majik: MajikBuwizDatabase): UseMUIDReturn {
  const { majikah } = useMajikah();

  const [uid, setUID] = useState<MajikUniversalID | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivatePersonalInfo | null>(
    null,
  );
  const [muidLoading, setMuidLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [showSetupAfterDelete, setShowSetupAfterDelete] = useState(false);

  // Monotonic generation counter — incremented on every intended fetch.
  // Only the fetch whose captured generation equals the current ref value
  // is allowed to commit its result.
  const fetchGenRef = useRef(0);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const doFetch = useCallback(async () => {
    // Capture generation BEFORE the async gap
    const gen = ++fetchGenRef.current;

    setMuidLoading(true);
    try {
      const raw = await majik.getMUIDJSON();

      // Stale fetch — a newer one has already started; silently discard
      if (gen !== fetchGenRef.current) return;

      if (!raw) {
        // Don't clobber a uid that was already set by a faster fetch
        setUID((prev) => prev ?? null);
        return;
      }

      const instance = await MajikUniversalID.fromJSON(raw);

      // Stale check again after the second await
      if (gen !== fetchGenRef.current) return;

      setUID(instance);

      if (instance.isPrivateDecrypted) {
        try {
          setPrivateInfo(instance.privateInfo as PrivatePersonalInfo);
        } catch {
          /* */
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = raw as any;
      if (r.didit_session_id) {
        setSessionStatus(r.didit_session_status ?? null);
        setVerificationUrl(r.didit_verification_url ?? null);
      }
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      console.error("[useUserMUID] fetch failed:", err);
    } finally {
      if (gen === fetchGenRef.current) setMuidLoading(false);
    }
  }, [majik]);

  // Public handle for manual refresh button
  const refresh = useCallback(() => {
    doFetch();
  }, [doFetch]);

  // ── Auth listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!majikah) return;

    const handleSignIn = () => {
      // Invalidate any in-flight fetch, then re-fetch
      doFetch();
    };

    const handleSignOut = () => {
      // Bump generation so any in-flight fetch is discarded
      fetchGenRef.current++;
      setUID(null);
      setPrivateInfo(null);
      setSessionStatus(null);
      setVerificationUrl(null);
      setMuidLoading(false);
    };

    majikah.on("sign-in", handleSignIn);
    majikah.on("sign-out", handleSignOut);
    return () => {
      majikah.off("sign-in", handleSignIn);
      majikah.off("sign-out", handleSignOut);
    };
  }, [majikah, doFetch]);

  // ── Initial fetch — runs once when majik instance is stable ───────────────
  // Deliberately NOT including majikah.user?.id or refreshTick so that auth
  // changes are handled exclusively by the sign-in/sign-out listeners above.
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // ── Realtime subscription (only while unverified) ──────────────────────────
  useEffect(() => {
    if (!uid || uid.isVerified) return;

    const rt = new SupabaseRealtime<MajikUniversalIDJSON>(
      "majik_universal_id",
      "majikah",
    );
    rt.subscribeToTable("user_id", uid.userId);

    const detach = rt.onListenUpdate(async (payload) => {
      if (payload.type === "UPDATE" && payload.new) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = payload.new as any;
        if (raw.didit_session_id) {
          setSessionStatus(raw.didit_session_status ?? null);
          setVerificationUrl(raw.didit_verification_url ?? null);
        }
        // Trigger a fresh fetch so the local MajikUniversalID instance is up to date
        doFetch();
      }
      if (payload.type === "DELETE" && payload.old?.id === uid.id) {
        setUID(null);
      }
    });

    return () => {
      detach();
      rt.cleanup();
    };
  }, [uid?.userId, uid?.isVerified, doFetch]);

  return {
    uid,
    privateInfo,
    muidLoading,
    sessionStatus,
    verificationUrl,
    showSetupAfterDelete,
    setUID,
    setPrivateInfo,
    setSessionStatus,
    setVerificationUrl,
    setShowSetupAfterDelete,
    refresh,
  };
}
