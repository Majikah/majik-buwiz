import { useMajikah } from "@src/components/majikah-session-wrapper/use-majikah";
import { useEffect, type JSX } from "react";

export default function CrispIdentify(): JSX.Element | null {
  const { majikah } = useMajikah();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ✅ Always ensure $crisp is an array
    if (!Array.isArray(window.$crisp)) {
      window.$crisp = [];
    }

    if (!majikah.isAuthenticated || !majikah?.user?.id) return;

    window.$crisp.push(["safe", true]);

    try {
      const user = majikah.user;
      const meta = user.metadata || {};

      // Collect all session data here
      const sessionData = [["uid", String(user.id)]];

      if (!!meta?.gender && typeof meta.gender === "string") {
        sessionData.push(["gender", meta.gender]);
      }

      if (!!meta?.birthdate && typeof meta.birthdate === "string") {
        sessionData.push(["birthday", meta.birthdate]);
      }

      const pushToCrisp = (): void => {
        if (!window?.$crisp || !majikah.isAuthenticated || !user?.id) return;

        // Send session data in one push
        if (sessionData.length > 0) {
          window.$crisp.push(["set", "session:data", [sessionData]]);
        }

        // Required/primary fields
        if (
          !!user?.email &&
          typeof user.email === "string" &&
          user.email.includes("@")
        ) {
          window.$crisp.push(["set", "user:email", [user.email]]);
        }

        if (
          !!user?.displayName &&
          typeof user.displayName === "string" &&
          user.displayName.trim() !== ""
        ) {
          window.$crisp.push(["set", "user:nickname", [user.displayName]]);
        }

        // Optional profile fields
        if (
          !!meta?.picture &&
          typeof meta.picture === "string" &&
          meta.picture.trim() !== "" &&
          meta.picture.startsWith("http")
        ) {
          window.$crisp.push(["set", "user:avatar", [meta.picture]]);
        }

        if (
          !!meta?.phone &&
          typeof meta.phone === "string" &&
          meta.phone.trim() !== ""
        ) {
          window.$crisp.push(["set", "user:phone", [meta.phone]]);
        }
      };

      /**
       * ✅ Correct way to detect when Crisp is fully loaded
       * This will be executed once synchronous methods like `$crisp.is()` are available
       */
      window.CRISP_READY_TRIGGER = function () {
        pushToCrisp();
      };
    } catch (error) {
      console.warn("Crisp Error: ", error);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majikah.user?.id, majikah.isAuthenticated]);

  return null;
}
