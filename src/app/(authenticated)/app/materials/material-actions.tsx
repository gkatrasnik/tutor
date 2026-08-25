"use client";

import { LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

async function mutate(url: string, method: "POST" | "DELETE") {
  const response = await fetch(url, { method });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
}

export function MaterialActions({ id, title, canRetry }: { id: string; title: string; canRetry: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      await mutate(`/api/materials/${id}/process`, "POST");
      toast.success("Material is ready.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
      router.refresh();
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      await mutate(`/api/materials/${id}`, "DELETE");
      toast.success("Material deleted.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {canRetry ? (
        <Button variant="outline" size="sm" onClick={retry} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Retry
        </Button>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${title}`} />}>
          <Trash2 aria-hidden="true" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes “{title}” and its private stored files.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>Delete material</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
