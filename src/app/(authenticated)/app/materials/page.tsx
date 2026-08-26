import { desc, eq } from "drizzle-orm";
import { FileText, Library, Search, Upload } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { materialChunks, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";

import { MaterialActions } from "./material-actions";
import { MaterialUploader } from "./material-uploader";

const statusLabels = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Needs attention",
} as const;

const statusVariants = {
  uploaded: "secondary",
  processing: "outline",
  ready: "default",
  failed: "destructive",
} as const;

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const user = await requireUser();
  const [library, chunkedMaterials] = await Promise.all([
    db.select().from(materials)
      .where(eq(materials.ownerId, user.id)).orderBy(desc(materials.createdAt)),
    db.selectDistinct({ materialId: materialChunks.materialId }).from(materialChunks)
      .where(eq(materialChunks.ownerId, user.id)),
  ]);
  const indexedMaterialIds = new Set(chunkedMaterials.map((row) => row.materialId));

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <div>
        <p className="text-sm font-medium text-emerald-700">Private source library</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">Materials</h1>
        <p className="mt-2 max-w-2xl text-stone-500">Add the source material Tutor will use to create grounded courses and answers.</p>
      </div>

      <Card className="mt-8 border-stone-200 bg-white">
        <CardHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><Upload className="size-5" aria-hidden="true" /></span>
          <CardTitle>Add material</CardTitle>
          <CardDescription>Documents are stored privately and only available to your account.</CardDescription>
        </CardHeader>
        <CardContent><MaterialUploader userId={user.id} /></CardContent>
      </Card>

      <section className="mt-10" aria-labelledby="library-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="library-heading" className="text-lg font-semibold tracking-tight">Your library</h2>
          <Badge variant="outline">{library.length} {library.length === 1 ? "item" : "items"}</Badge>
        </div>
        {library.length ? (
          <div className="grid gap-4">
            {library.map((material) => {
              const isIndexed = indexedMaterialIds.has(material.id);
              return (
                <Card key={material.id} className="border-stone-200 bg-white">
                  <CardContent className="flex items-start gap-4 p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600"><FileText className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-medium text-stone-950">{material.originalFilename}</h3>
                        <Badge variant={statusVariants[material.status]}>{statusLabels[material.status]}</Badge>
                        {material.status === "ready" && !isIndexed ? <Badge variant="outline">Needs indexing</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {material.sourceType === "pdf" ? "PDF" : "Pasted text"}
                        {material.pageCount ? ` · ${material.pageCount} pages` : ""}
                        {material.characterCount ? ` · ${material.characterCount.toLocaleString()} characters` : ""}
                        {` · ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(material.createdAt)}`}
                      </p>
                      {material.processingError ? <p className="mt-2 text-sm text-red-700">{material.processingError}</p> : null}
                    </div>
                    <MaterialActions
                      id={material.id}
                      title={material.originalFilename}
                      canRetry={material.status !== "ready" || !isIndexed}
                      retryLabel={material.status === "ready" && !isIndexed ? "Index" : "Retry"}
                    />
                    {process.env.NODE_ENV === "development" && material.status === "ready" && isIndexed ? (
                      <Link
                        href={`/app/materials/${material.id}/retrieval`}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-950"
                        aria-label={`Inspect retrieval for ${material.originalFilename}`}
                      >
                        <Search className="size-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-stone-300 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center px-6 py-10 text-center">
              <Library className="size-8 text-stone-400" aria-hidden="true" />
              <h3 className="mt-3 font-medium">Your library is empty</h3>
              <p className="mt-1 text-sm text-stone-500">Upload a PDF or paste notes above to get started.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
