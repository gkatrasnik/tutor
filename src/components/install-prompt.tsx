"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { TutorMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

const preferenceKey = "tutor-install-dismissed";

function isDismissed() {
  try {
    return (
      localStorage.getItem(preferenceKey) === "never" ||
      sessionStorage.getItem(preferenceKey) === "later"
    );
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"native" | "ios" | null>(null);
  const pending = useRef<InstallEvent | null>(null);
  const dismissed = useRef(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const isInstalled = () =>
      standalone.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const timer = window.setTimeout(() => {
      if (isIOS && !isInstalled() && !isDismissed() && !dismissed.current) {
        setMode("ios");
      }
    }, 1000);

    function beforeInstall(event: Event) {
      event.preventDefault();
      if (isInstalled() || isDismissed() || dismissed.current) return;
      pending.current = event as InstallEvent;
      setMode("native");
    }

    function hide() {
      dismissed.current = true;
      pending.current = null;
      setMode(null);
    }

    function displayChanged() {
      if (isInstalled()) hide();
    }

    function preferenceChanged(event: StorageEvent) {
      if (event.key === preferenceKey && isDismissed()) hide();
    }

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", hide);
    window.addEventListener("storage", preferenceChanged);
    standalone.addEventListener("change", displayChanged);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", hide);
      window.removeEventListener("storage", preferenceChanged);
      standalone.removeEventListener("change", displayChanged);
    };
  }, []);

  function dismiss(permanent: boolean) {
    dismissed.current = true;
    pending.current = null;
    setMode(null);
    try {
      if (permanent) localStorage.setItem(preferenceKey, "never");
      else sessionStorage.setItem(preferenceKey, "later");
    } catch {
      // The in-memory dismissal still works when browser storage is unavailable.
    }
  }

  async function install() {
    const event = pending.current;
    if (!event) return;
    // A browser install event can only be used once.
    pending.current = null;
    setMode(null);
    try {
      const result = await event.prompt();
      if (result.outcome === "dismissed") dismiss(false);
    } catch {
      toast.error(
        "Installation could not start. Try your browser’s install menu.",
      );
    }
  }

  if (!mode) return null;

  return (
    <aside
      aria-labelledby="install-tutor-title"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-50 rounded-xl border bg-card p-4 text-card-foreground shadow-xl sm:left-auto sm:w-[410px]"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <TutorMark className="size-8" />
        <h2 id="install-tutor-title" className="text-base font-bold">
          Install Tutor
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {mode === "ios"
          ? "To install Tutor, open your browser’s Share menu and choose Add to Home Screen."
          : "Install our app on your device for quick and easy access."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => dismiss(false)}>
          Not now
        </Button>
        <Button variant="outline" onClick={() => dismiss(true)}>
          Never
        </Button>
        {mode === "native" && <Button onClick={install}>Install</Button>}
      </div>
    </aside>
  );
}
