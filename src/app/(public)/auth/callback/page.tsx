import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brand } from "@/components/brand";

import { AuthCallbackClient } from "./callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <Brand className="mx-auto mb-8 w-fit text-lg" />
        <Card className="border-border bg-card">
          <CardHeader className="text-center">
            <CardTitle>Signing you in</CardTitle>
            <CardDescription>
              Verifying your single-use email link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthCallbackClient />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
