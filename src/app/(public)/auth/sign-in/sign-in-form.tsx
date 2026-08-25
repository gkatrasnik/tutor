"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const result = await authClient.signIn.magicLink({
        email: email.trim().toLowerCase(),
        callbackURL: "/auth/callback",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "We could not send a sign-in link.");
      }

      setMessage("Check your inbox. Your secure sign-in link is on its way.");
      toast.success("Magic link sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send a sign-in link.");
      toast.error("Sign-in request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={requestMagicLink} className="space-y-5">
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="email">Email address</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="email-description email-error"
          className="h-11"
        />
        <FieldDescription id="email-description">
          We will email you a single-use link. No password needed.
        </FieldDescription>
        <FieldError id="email-error" errors={error ? [{ message: error }] : undefined} />
      </Field>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Mail aria-hidden="true" />
        )}
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </Button>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
