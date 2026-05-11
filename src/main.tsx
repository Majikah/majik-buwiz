// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ReduxProvider from "./redux/ReduxProvider";
import ThemeProviderWrapper from "./globals/ThemeProviderWrapper";
import { HashRouter } from "react-router-dom";
import { ErrorBoundary } from "./components/functional/ErrorBoundary";
import ConnectionDetector from "./components/functional/ConnectionDetector";
import { ShepherdProvider } from "./lib/shepherd-js/ShepherdTourContext";
import { MajikBuwizWrapper } from "./components/majik-context-wrapper/MajikBuwizWrapper";
import { Toaster } from "sonner";
import { MajikahProvider } from "./components/majikah-session-wrapper/MajikahSessionWrapper";

import "./App.css";
import CrispIdentify from "./lib/crisp/CrispIdentify";

import LogRocketInit from "./lib/log-rocket/LogRocketInit";


const worker = new Worker(new URL("./sqlite-worker.ts", import.meta.url), {
  type: "module",
});

// optional: expose globally or via singleton
export default worker;

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <ReduxProvider>
    <ThemeProviderWrapper>
      <HashRouter>
        <ErrorBoundary>
          <ConnectionDetector>
            <ShepherdProvider>
              <MajikahProvider>
                <MajikBuwizWrapper>
                  <LogRocketInit />
                  <App />
                  <Toaster
                    expand={true}
                    position="top-center"
                    toastOptions={{
                      classNames: {
                        toast: "toast-main",
                        title: "toast-title",
                        description: "toast-description",
                        actionButton: "toast-action-button",
                        cancelButton: "toast-cancel-button",
                        closeButton: "toast-close-button",
                      },
                    }}
                  />
                  <CrispIdentify />
                </MajikBuwizWrapper>
              </MajikahProvider>
            </ShepherdProvider>
          </ConnectionDetector>
        </ErrorBoundary>
      </HashRouter>
    </ThemeProviderWrapper>
  </ReduxProvider>,
  // </StrictMode>,
);
