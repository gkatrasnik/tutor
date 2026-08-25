"use client";

import { upload } from "@vercel/blob/client";
import { FileText, FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PDF_BYTES, MAX_TEXT_CHARACTERS, materialUploadPrefix } from "@/lib/materials/constants";

type ApiResult = { id?: string; error?: string };

async function parseResponse(response: Response) {
  const result = (await response.json()) as ApiResult;
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function MaterialUploader({ userId }: { userId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [characterCount, setCharacterCount] = useState(0);

  async function finishMaterial(id: string) {
    setProgress(90);
    await parseResponse(await fetch(`/api/materials/${id}/process`, { method: "POST" }));
    setProgress(100);
    toast.success("Material is ready to use.");
    router.refresh();
  }

  async function handlePdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = fileInput.current?.files?.[0];
    if (!file) return setError("Choose a PDF to upload.");
    if (file.type !== "application/pdf") return setError("Only PDF files are supported.");
    if (file.size > MAX_PDF_BYTES) return setError("PDF files must be no larger than 5 MB.");

    setBusy(true);
    setError(null);
    setProgress(5);
    try {
      const pathname = `${materialUploadPrefix(userId)}${crypto.randomUUID()}.pdf`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/materials/upload",
        contentType: "application/pdf",
        onUploadProgress: ({ percentage }) => setProgress(Math.max(5, Math.round(percentage * 0.75))),
      });
      setProgress(80);
      const registered = await parseResponse(await fetch("/api/materials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceType: "pdf",
          url: blob.url,
          pathname: blob.pathname,
          originalFilename: file.name,
        }),
      }));
      if (!registered.id) throw new Error("The material could not be created.");
      await finishMaterial(registered.id);
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The upload failed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "");
    const text = String(form.get("text") ?? "");
    setBusy(true);
    setError(null);
    setProgress(25);
    try {
      const created = await parseResponse(await fetch("/api/materials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceType: "text", title, text }),
      }));
      if (!created.id) throw new Error("The material could not be created.");
      setProgress(75);
      await finishMaterial(created.id);
      formElement.reset();
      setCharacterCount(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The text could not be saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Material could not be added</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Tabs defaultValue="pdf">
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="pdf"><FileUp aria-hidden="true" /> Upload PDF</TabsTrigger>
          <TabsTrigger value="text"><FileText aria-hidden="true" /> Paste text</TabsTrigger>
        </TabsList>
        <TabsContent value="pdf" className="pt-5">
          <form onSubmit={handlePdf} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material-pdf">PDF document</Label>
              <Input ref={fileInput} id="material-pdf" type="file" accept="application/pdf,.pdf" disabled={busy} />
              <p className="text-xs text-stone-500">Up to 5 MB and 50 pages. Scanned image-only PDFs are not supported yet.</p>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
              Upload and prepare
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="text" className="pt-5">
          <form onSubmit={handleText} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input id="material-title" name="title" placeholder="e.g. Biology lecture notes" maxLength={255} disabled={busy} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="material-text">Your text</Label>
                <span className="text-xs tabular-nums text-stone-500">{characterCount.toLocaleString()} / {MAX_TEXT_CHARACTERS.toLocaleString()}</span>
              </div>
              <Textarea id="material-text" name="text" className="min-h-48 resize-y" maxLength={MAX_TEXT_CHARACTERS} onChange={(event) => setCharacterCount(event.target.value.length)} disabled={busy} required />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
              Save and prepare
            </Button>
          </form>
        </TabsContent>
      </Tabs>
      {busy ? (
        <div className="mt-5 space-y-2" aria-live="polite">
          <div className="flex justify-between text-xs text-stone-500"><span>Preparing your material…</span><span>{progress}%</span></div>
          <Progress value={progress} />
        </div>
      ) : null}
    </div>
  );
}
