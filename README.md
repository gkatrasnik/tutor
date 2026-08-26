# Tutor

Tutor turns a learner's private PDF or pasted text into a focused course and a grounded, Socratic tutoring experience.

This repository currently contains **Iterations 1–7: Foundation, Neon database discipline, magic-link authentication, private material uploads, Cohere-backed retrieval, structured course outlines, and persistent Socratic tutoring** from the implementation plan.

## Start locally

Requirements: Node.js 22+ and pnpm.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/auth/sign-in`, manage private learning sources at `/app/materials`, and use the allowlisted admin area at `/admin`.

## Debug in VS Code

Open **Run and Debug** (`Ctrl+Shift+D`), select **Next.js: debug full stack**, and press `F5`. VS Code starts the development server with the Node inspector, waits for `http://localhost:3000`, and opens a Chrome debugging session. Breakpoints work in both Server Components/Route Handlers and `"use client"` components.

Other profiles in `.vscode/launch.json` support server-only debugging, browser-only debugging when `pnpm dev` is already running, and attaching to a server started manually with `pnpm dev --inspect`.

## Quality checks

```bash
pnpm test
pnpm lint
pnpm build
```

## Database workflow

Application queries use Neon's pooled `DATABASE_URL` over the HTTP serverless driver. Drizzle Kit prefers `DATABASE_URL_UNPOOLED` for schema migrations, falling back to `DATABASE_URL` when needed.

```bash
# Generate a versioned migration after changing src/db/schema.ts
pnpm db:generate

# Inspect the generated SQL, then apply pending migrations
pnpm db:migrate

# Optionally inspect the schema locally
pnpm db:studio
```

The initial migrations enable `pgvector`, create the profile and material tables, define `vector(1536)` embeddings, and add a cosine-distance HNSW index. In development, `/api/health/database` performs a typed connectivity check and reports whether the vector extension is enabled. The route returns `404` in production.

When Neon is installed through the Vercel Marketplace with Preview enabled, Vercel preview deployments receive Neon branch-specific connection variables automatically. Confirm Preview is selected under the Neon integration's connected environments before relying on this isolation.

## Neon Auth setup

1. In the Neon/Vercel integration settings, enable Auth for the production branch. The integration supplies a branch-specific `NEON_AUTH_BASE_URL` and configures Vercel deployment origins.
2. In the Neon Auth configuration, enable Magic Link sign-in and built-in email delivery.
3. Add `http://localhost:3000` as a trusted development origin. Production and preview deployment origins are managed automatically by the Vercel integration when Auth is connected.
4. Generate one stable secret with at least 32 characters and set `NEON_AUTH_COOKIE_SECRET` in Local, Preview, and Production environments.
5. Set `ADMIN_EMAILS` to a comma-separated allowlist. Addresses are normalized to lowercase; roles are not stored or editable in v1.
6. Pull the updated Vercel variables into `.env.local`, then redeploy.

The auth proxy performs an optimistic session check for `/app/**` and `/admin/**`. Secure authorization is repeated in the server-only data access layer before profile creation or admin access. The callback creates or refreshes the application profile and then redirects to `/app`.

## Private material storage

1. Create a Vercel Blob store with **Private** access and connect it to this project.
2. Ensure `BLOB_READ_WRITE_TOKEN` is available in Local, Preview, and Production environments, then pull the local variables again.
3. Run `pnpm db:migrate` after pulling this iteration to add the extracted-text Blob references.

PDFs upload directly from the browser to Blob through an authenticated, account-scoped token endpoint. The app accepts PDFs up to 5 MB and 50 pages, extracts text server-side, and rejects encrypted, malformed, image-only, or oversized documents with a visible error. Pasted text is limited to 100,000 characters. Original and extracted artifacts remain private, while database rows track `uploaded`, `processing`, `ready`, and `failed` states. Users can retry failed processing or permanently delete a material and its Blob objects.

## App Router structure

Route groups organize code without changing URLs:

```text
src/app/
├── (public)/page.tsx               → /
├── (public)/auth/                   → /auth/sign-in and /auth/callback
├── (authenticated)/app/            → /app
│   ├── materials/                   → /app/materials
│   ├── courses/[id]/                → /app/courses/:id
│   └── sessions/[id]/               → /app/sessions/:id
├── (admin)/admin/                   → /admin
├── globals.css
└── layout.tsx
```

Pages and layouts are Server Components unless a file explicitly begins with `"use client"`. Client boundaries are limited to interactive forms, upload progress, notifications, and accessible UI primitives.

shadcn/ui components live in `src/components/ui`. They are source-owned: the application can inspect, test, and adapt them instead of depending on a black-box component package.

## Deploy to Vercel

1. Push this repository to a Git provider.
2. Import it into Vercel as a Next.js project.
3. Copy the values from `.env.example` into the Vercel project settings and set `NEXT_PUBLIC_APP_URL` to the production origin.
4. Deploy. Every branch or pull request receives a preview deployment; changes on the production branch promote through the production deployment lifecycle.

## RAG ingestion and retrieval

Material processing now normalizes source text, creates page-aware chunks of approximately 800 tokens with 100-token overlap, and embeds at most 150 chunks in batches of 50. Stored chunks use Cohere's `search_document` input type; retrieval queries use `search_query`. Both explicitly request 1,536-dimensional float embeddings from `cohere/embed-v4.0` through AI Gateway.

Create a dedicated Tutor AI Gateway API key, enable a $5 monthly spend quota, and add `AI_GATEWAY_API_KEY` to `.env.local` plus the Vercel Development, Preview, and Production environments. Keep auto-top-up disabled. Although Vercel deployments can authenticate automatically through OIDC, this app intentionally uses the dedicated key so the plan's per-key budget applies to every embedding and generation request.

In development, ready materials have a search icon that opens the retrieval inspector. It displays the six closest owned chunks with similarity, excerpt, ordinal, and PDF page metadata. The inspector returns 404 in production.

## Course outlines (Iteration 6)

Run `pnpm db:migrate` before starting or deploying this iteration. Migration `0003_course_outlines.sql` adds outlines; `0004_course_first_materials.sql` changes the relationship to **one course → many materials**. Stop the old app while applying the latter migration, then start/deploy the updated code. Existing courses keep their IDs, outlines, and lessons. Existing materials keep their files, IDs, and embeddings, and become attached to their original course; materials without a course receive a named draft course. No new secrets are needed: outlines use the existing `AI_GATEWAY_API_KEY` and `TUTOR_MODEL` (default `alibaba/qwen3.7-flash`).

Create a named course at `/app`, then open `/app/courses/:id` to upload PDFs (one at a time) and paste multiple sets of notes. All materials require an owned course. Uploading only stores and indexes each material; it does not generate an outline. Once every source is indexed, click **Generate outline** to synthesize all course materials into a title, summary, and 4–8 ordered lessons, each with an objective, key concepts, and a retrieval query for future tutoring. The course name remains the learner's chosen name, separate from the generated outline title.

The model receives ordered, owner- and course-scoped chunks grouped by source ID and filename, with page metadata kept separate. Combined input is limited to 300 chunks and 200,000 indexed characters (including overlap); exceeding either limit shows an error rather than silently dropping sources. AI SDK structured output is Zod-validated, thinking is disabled with `reasoning: "none"`, and each attempt is limited to 2,500 output tokens and 45 seconds. Invalid structured output gets one automatic retry; other failures require a user retry. No tools or external lookup are enabled.

`/app/materials` remains an overview across courses, with links back to each course. A failed outline leaves materials and embeddings ready; **Retry outline** calls `POST /api/courses/:id/outline` without re-indexing. These requests run synchronously, so keep the page open while generating. Interrupted generation claims can be reclaimed after five minutes by clicking **Check generation**. This is not a background job queue.

Adding, removing, or re-indexing material increments the course's `source_version` through a database trigger. The old outline remains visible and is marked out of date; click **Update outline** after the source changes are complete. Current outlines are reused without another model call. Manual outline editing remains out of scope. Deleting a material removes only its files and chunks, not its course or lessons. Course deletion is not exposed; its foreign key restricts deletion while it still has material files to clean up.

An atomic database claim prevents overlapping active attempts. Publication uses a Neon HTTP `db.batch` transaction: lock the course, delete previous lessons, insert the replacement lessons, and update the outline version. Every statement is guarded by the owner, course, generation token, and source version. The trigger takes the same course row lock, so source changes cannot be published as current. Failed publication rolls back to the previous outline; stale workers cannot overwrite a newer attempt. The old per-material generation endpoint has been removed.

Interactive tutoring is available from each lesson. Assessment, completion, and stored learner progress belong to Iteration 8. Progress is currently an honest 0%; viewing an outline or chatting does not mark a lesson complete.

### Try it locally

1. Apply the migrations, then start the app and sign in. Check that old courses/materials still exist.
2. Create a course named “Biology revision”. It should open immediately with no materials or outline.
3. Upload a PDF and paste notes into that same course. Both should become indexed, without automatically generating lessons.
4. Click **Generate outline**. Expand the 4–8 lessons and check that they cover both sources in a sensible order.
5. Add a third source. The old outline should be marked out of date; **Update outline** should include the new source without re-embedding the earlier ones.
6. Delete one source. The course and old outline should remain; update again using the remaining materials.
7. Sign in as a different user: the course must not appear, its direct URL must show not found, and uploads/generation targeting it must be rejected.

Automated tests cover output validation/retries, provider settings, course creation and upload ownership, multiple sources, input limits, stale generation, migration preservation, and atomic outline replacement. Course-service tests keep the real Neon HTTP adapter but execute its SQL against isolated PGlite PostgreSQL, not your Neon database. The test fixture substitutes an array for pgvector (vector search is not under test); all course migration and transaction SQL runs unchanged. Providers and Blob storage are mocked. The steps above exercise live Neon, Blob, and AI Gateway.

## Socratic tutoring (Iteration 7)

Apply `pnpm db:migrate` before starting this version. Migration `0005_tutor_sessions.sql` adds `tutor_sessions`, `messages`, and `tutor_daily_usage`; no additional secrets are required.

Open a course with a current outline, expand a lesson, and select **Start / resume lesson**. This creates or reuses a persistent session without calling AI. In the conversation, select **Begin lesson** or send a question. The tutor explains one idea briefly, asks one focused question, and favors hints. These behaviors are prompt instructions, not guarantees of factual correctness; inspect the source passages when in doubt.

### Request walkthrough

1. The Server Component loads the owned session and recent saved messages. Only the chat, send controls, and source Sheet are Client Components.
2. The browser posts a fresh request ID and a message (maximum 2,000 characters) to `/api/tutor/sessions/:id/messages`. The server ignores supplied roles, history, owners, and source IDs: it loads trusted conversation state from the database.
3. The server checks ownership and the current course/outline version, claims the session atomically, saves the learner message plus a pending answer, and reserves one of 30 tutor turns per UTC day. A concurrent active request receives `409`; an exhausted daily allowance receives `429` before retrieval.
4. Retrieval embeds the lesson objective, retrieval query, and latest learner message. The cosine query selects the nearest six chunks across **all indexed materials in this course**, with course, material, and chunk ownership filters.
5. `streamText` uses `TUTOR_MODEL`, `reasoning: "minimal"`, an 800-token output cap, no automatic retries, and a 60-second signal covering retrieval plus generation. Only the last 20 saved messages are included in the model context. No web search or tools are enabled; source text and lesson metadata are explicitly untrusted data.
6. The route streams newline-delimited `delta` events. After a successful provider finish, a token- and source-version-guarded HTTP transaction saves the answer and retrieved chunk IDs, releases the session, and only then emits `done`. An incomplete/failed answer emits a safe error and is not saved as complete.

The session page shows the latest 100 saved messages. **Sources** opens a shadcn Sheet with the original filename, page (for PDFs), and retrieved excerpt. Labels match the prompt's `[1]`, `[2]`, etc. references. These are retrieved passages, not a claim-by-claim correctness guarantee. Source access is reauthorized on every request; no private Blob URLs are returned. If a cited material was removed or re-indexed, the old reference is shown as unavailable.

### Recovery and source changes

- Returning to a lesson resumes its saved conversation. Replaying an already-completed request ID returns the saved result without another model call or quota reservation.
- If the browser disconnects, the server continues consuming the bounded stream; Next.js `after` keeps the completion task alive within the route's 120-second duration. Refresh to check the saved result before resending. This is not a durable background queue; a process crash may still interrupt a response.
- Failed partial answers are not stored as completed answers. Their learner questions remain visible. Interrupted session claims can be replaced after two minutes; tokens fence off late results from the old worker.
- Once retrieval starts, an attempt consumes the daily allowance even if generation fails or the client disconnects, because embedding/provider work may be billable. The daily limit is shared across sessions and resets at midnight UTC.
- Adding, deleting, or re-indexing sources makes existing sessions read-only. Regenerating the outline detaches the replaced lesson IDs but **preserves sessions and messages**. Find them under **Recent conversations** on the course page. Start a new current lesson to continue tutoring with the new sources.

The planned full usage/cost ledger, ingestion quotas, and Firewall rate limits remain Iteration 9. The daily tutor reservation is included now so the streaming path is bounded from its first release. Assessments and **Finish lesson** are the next milestone.

### Tutor smoke test

1. Apply the migration, start the app, and open a course containing at least two indexed materials.
2. Start a lesson and select **Begin lesson**. Verify that text streams and a single opening question appears.
3. Reply, ask for a hint, and open **Sources**. Check the filename/page/excerpt against your uploaded material.
4. Reload or navigate away and return: both sides of the conversation should remain.
5. Open the session URL as another user: access should be denied. The same applies to message and source endpoints.
6. Add a source and update the outline: the old conversation should remain readable, with new sends disabled.

Automated tests use a fake streaming provider and execute the Neon HTTP adapter's SQL in isolated PostgreSQL. They cover persistence, failures, disconnects, duplicate requests, lease recovery, source-version races, ownership, daily rollover/concurrent quota reservations, and UTF-8 stream framing. Live provider quality and browser interaction still require the smoke test above; no tests send real learner content or incur model charges.
