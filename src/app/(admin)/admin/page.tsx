import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Brand />
          <Badge variant="outline"><ShieldCheck aria-hidden="true" /> {admin.email}</Badge>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Operations overview</h1>
        <p className="mt-2 text-stone-500">Aggregate AI usage and cost reporting arrives in Iteration 10.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {["Requests", "Tokens", "Actual cost"].map((label) => (
            <Card key={label}>
              <CardHeader><CardTitle className="text-sm font-medium text-stone-500">{label}</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">—</CardContent>
            </Card>
          ))}
        </div>
        <Link href="/" className={`${buttonVariants({ variant: "outline" })} mt-8`}>Back to home</Link>
      </div>
    </main>
  );
}
