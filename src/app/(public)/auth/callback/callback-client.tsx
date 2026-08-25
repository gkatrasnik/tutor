"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { authClient } from "@/lib/auth/client";

export function AuthCallbackClient() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeMagicLink() {
      const verifier = new URLSearchParams(window.location.search).get("neon_auth_session_verifier");
      if (!verifier) {
        if (active) setFailed(true);
        return;
      }

      try {
        // The Neon client forwards the verifier through our same-origin
        // /api/auth proxy, which stores the returned session cookies.
        const { data, error } = await authClient.getSession();
        if (error || !data?.user) throw new Error("Session exchange failed");
        window.location.replace("/app");
      } catch {
        if (active) setFailed(true);
      }
    }

    void completeMagicLink();
    return () => { active = false; };
  }, []);

  if (failed) {
    return (
      <Alert variant="destructive">
        <AlertTitle>This sign-in link could not be completed</AlertTitle>
        <AlertDescription>
          The link may be expired or already used. Return to sign in and request a fresh email.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 text-sm text-stone-600" role="status">
      <LoaderCircle className="size-5 animate-spin text-emerald-700" aria-hidden="true" />
      Completing your secure sign-in…
    </div>
  );
}
