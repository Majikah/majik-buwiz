// components/LogRocketInit.tsx

import { useEffect } from "react";
import LogRocket from "logrocket";

import { useMajikah } from "@src/components/majikah-session-wrapper/use-majikah";

export default function LogRocketInit(): null {
  const { majikah, loading } = useMajikah();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      LogRocket.init("3ld2gi/majik-buwiz", {
        network: {
          requestSanitizer: (request) => {
            return request;
          },
          responseSanitizer: (response) => {
            return response;
          },
        },
      });

      if (
        majikah.isAuthenticated &&
        !!majikah.user &&
        !!majikah.user?.id &&
        majikah.user.id.trim() !== "" &&
        !loading
      ) {
        const userFullName: string =
          majikah.user.formattedName ||
          majikah.user.displayName ||
          "Unknown User";

        LogRocket.identify(majikah.user.id, {
          name: userFullName,
          email: majikah.user.email!,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
