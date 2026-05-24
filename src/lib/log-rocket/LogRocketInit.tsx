// components/LogRocketInit.tsx

import { useEffect, useState } from "react";
import LogRocket from "logrocket";

import { useMajikah } from "@src/components/majikah-session-wrapper/use-majikah";
import { useMajik } from "@/components/majik-context-wrapper/use-majik";

export default function LogRocketInit(): null {
  const { majikah, loading } = useMajikah();
  const { majik } = useMajik();
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    majik.isAnalyticsEnabled().then(setAnalyticsEnabled);
  }, [majik]);

  useEffect(() => {
    if (analyticsEnabled === null) return; // still resolving
    if (!analyticsEnabled) return; // opted out — do nothing
    if (process.env.NODE_ENV !== "production") return;

    LogRocket.init("3ld2gi/majik-buwiz", {
      network: {
        requestSanitizer: (request) => request,
        responseSanitizer: (response) => response,
      },
    });

    if (
      majikah.isAuthenticated &&
      !!majikah.user?.id &&
      majikah.user.id.trim() !== "" &&
      !loading
    ) {
      const userFullName =
        majikah.user.formattedName ||
        majikah.user.displayName ||
        "Unknown User";

      LogRocket.identify(majikah.user.id, {
        name: userFullName,
        email: majikah.user.email!,
      });
    }
  }, [analyticsEnabled, majikah, loading]);

  return null;
}
