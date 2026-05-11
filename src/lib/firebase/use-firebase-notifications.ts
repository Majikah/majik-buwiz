import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useNavigate } from "react-router-dom";

import type { MajikahSession } from "@src/components/majikah-session-wrapper/majikah-session";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { MajikMessagePublicKey } from "@/SDK/majik-buwiz-client/src/index";

interface FirebaseTauriConfig {
  apiKey: string;
  appId: string;
  projectId: string;
  vapidKey?: string;
  messagingSenderId: string;
}

interface UseTauriPushProps {
  session: MajikahSession | null;
  publicKey: MajikMessagePublicKey | null;
  config: FirebaseTauriConfig;
  enabled?: boolean;
}

export function useFirebaseTauriPush({
  session,
  publicKey,
  config,
  enabled = true,
}: UseTauriPushProps): void {
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  // =========================
  // Token Registration Logic
  // =========================
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.warn(
        "[FCM] Service workers not supported in this webview — skipping push setup",
      );
      return;
    }
    if (!enabled) return;
    if (!session?.isAuthenticated) return;
    if (!publicKey) return;
    if (registeredRef.current) return;

    let unsubscribeOnMessage: (() => void) | undefined;

    const setup = async () => {
      try {
        // Initialise Firebase app (guard against double-init on HMR)
        const firebaseApp = getApps().length
          ? getApp()
          : initializeApp({
              apiKey: config.apiKey,
              appId: config.appId,
              projectId: config.projectId,
              messagingSenderId: config.messagingSenderId,
            });

        const messaging = getMessaging(firebaseApp);

        // Get FCM token — vapidKey required for web push
        const token = await getToken(messaging, {
          vapidKey: config.vapidKey,
        });

        if (!token) {
          console.warn(
            "[FCM] No token returned — check VAPID key and browser permissions",
          );
          return;
        }

        // Register with your backend only when token changes
        const existing = localStorage.getItem("fcm_token");
        if (token !== existing) {
          await session.registerPushToken(token, publicKey, "tauri");
          localStorage.setItem("fcm_token", token);
          console.log("[FCM] Token registered");
        }

        registeredRef.current = true;

        // =========================
        // Foreground Messages
        // =========================
        unsubscribeOnMessage = onMessage(messaging, async (payload) => {
          const title = payload.notification?.title ?? "New message";
          const body = payload.notification?.body ?? "";
          const conversationId = payload.data?.conversationId;
          const messageId = payload.data?.messageId ?? conversationId;

          // Show in-app sonner toast
          toast(title, {
            id: `push-${messageId}`,
            description: body,
            action: conversationId
              ? {
                  label: "Open",
                  onClick: () =>
                    navigate(
                      `/chats?conversationID=${encodeURIComponent(conversationId)}`,
                    ),
                }
              : undefined,
          });

          // Also fire a native OS notification for when the window is in background
          // (Tauri plugin-notification handles this cross-platform)
          try {
            let permissionGranted = await isPermissionGranted();
            if (!permissionGranted) {
              const permission = await requestPermission();
              permissionGranted = permission === "granted";
            }
            if (permissionGranted) {
              sendNotification({ title, body });
            }
          } catch {
            // Non-fatal — OS notification is best-effort
          }
        });
      } catch (err) {
        console.error("[FCM] Setup failed:", err);
        registeredRef.current = false;
      }
    };

    setup();

    return () => {
      unsubscribeOnMessage?.();
      registeredRef.current = false;
    };
  }, [session?.isAuthenticated, publicKey, enabled, config]);
}
