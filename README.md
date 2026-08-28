# Tutor

Tutor turns a learner's private PDF or pasted text into a focused course and a grounded, Socratic tutoring experience.

This repository currently contains **Iterations 1–10: Foundation, Neon database discipline, magic-link authentication, private material uploads, OpenAI-backed retrieval, structured course outlines, persistent Socratic tutoring, assessment/progress, usage accounting/rate limits, and learner/admin analytics** from the implementation plan. Production hardening remains Iteration 11.

## Start locally

Requirements: Node.js 22+ and pnpm.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/auth/sign-in`, manage private learning sources inside courses at `/app`, and use the allowlisted admin area at `/admin`.

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
│   ├── courses/[id]/                → /app/courses/:id
│   ├── sessions/[id]/               → /app/sessions/:id
│   └── materials/[id]/retrieval/    → admin-only retrieval inspector
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

Material processing normalizes source text, creates page-aware chunks of approximately 800 tokens with 100-token overlap, and embeds at most 150 chunks in batches of 50. Documents and queries use `openai/text-embedding-3-small` through AI Gateway with 1,536 dimensions. The adapter also retains explicit support for `cohere/embed-v4.0` with its document/query input types. Other models need an adapter before being enabled. Each chunk records its embedding model; retrieval rejects unknown/incompatible indexes and filters vectors by the configured model. Gateway requests use no automatic retries and report embedding rate limits separately.

### Changing the embedding model without losing progress

Keep `EMBEDDING_DIMENSION=1536`. Set `EMBEDDING_MODEL=openai/text-embedding-3-small` in `.env.local` and the appropriate Vercel environments, leaving the tutor model and Gateway key unchanged. Migration `0007_embedding_model.sql` adds a nullable model label, not a new vector size. Old rows deliberately start with unknown labels and must be re-embedded.

Pause ingestion/retrieval while switching, including older deployments sharing this database. Then run:

```sh
pnpm db:migrate
pnpm embeddings:reembed --dry-run
pnpm embeddings:reembed --probe
pnpm embeddings:reembed --apply
```

The CLI loads Next.js environment files (development by default, production with `NODE_ENV=production`) and targets exactly `DATABASE_URL`, across all owners in that database. Dry-run is the default and makes no AI requests or writes. Probe makes one tiny billable Gateway request. Apply probes again, embeds mismatched/unknown chunks, validates every result, and swaps all replacements in one Neon HTTP transaction. A short write lock and snapshot check reject concurrent chunk changes. Provider failures leave the original index intact; successful reruns skip already-labelled chunks. Source content is sent only to the configured embedding provider and is never logged or saved locally by the script.

Only `material_chunks.embedding` and `embedding_model` change: chunk IDs/content, material status, course source versions, lessons, conversations, citations, and assessment progress are preserved and verified. This is **not** the ordinary material retry/reindex action, which replaces chunks and changes source versions. The atomic CLI is intentionally limited to 2,000 total chunks; larger indexes need a staged migration. Restart/deploy the updated app with the matching model after the command succeeds. Repeat separately for any other Neon branches used by Preview/Production. Free Gateway credits do not guarantee model availability or freedom from rate limits.

Create a dedicated Tutor AI Gateway API key, enable a $5 monthly spend quota, and add `AI_GATEWAY_API_KEY` to `.env.local` plus the Vercel Development, Preview, and Production environments. Keep auto-top-up disabled. Although Vercel deployments can authenticate automatically through OIDC, this app intentionally uses the dedicated key so the plan's per-key budget applies to every embedding and generation request.

For allowlisted administrators, ready material cards link to the retrieval inspector. It displays the six closest owned chunks with similarity, excerpt, ordinal, and PDF page metadata. The page enforces the admin allowlist on the server in every environment; hiding the link is not the authorization boundary.

## Course outlines (Iteration 6)

Run `pnpm db:migrate` before starting or deploying this iteration. Migration `0003_course_outlines.sql` adds outlines; `0004_course_first_materials.sql` changes the relationship to **one course → many materials**. Stop the old app while applying the latter migration, then start/deploy the updated code. Existing courses keep their IDs, outlines, and lessons. Existing materials keep their files, IDs, and embeddings, and become attached to their original course; materials without a course receive a named draft course. No new secrets are needed: outlines use the existing `AI_GATEWAY_API_KEY` and `TUTOR_MODEL` (default `alibaba/qwen3.7-flash`).

Create a named course at `/app`, then open `/app/courses/:id` to upload PDFs (one at a time) and paste multiple sets of notes. All materials require an owned course. Uploading only stores and indexes each material; it does not generate an outline. Once every source is indexed, click **Generate outline** to synthesize all course materials into a title, summary, and 4–8 ordered lessons, each with an objective, key concepts, and a retrieval query for future tutoring. The course name remains the learner's chosen name, separate from the generated outline title.

The model receives ordered, owner- and course-scoped chunks grouped by source ID and filename, with page metadata kept separate. Combined input is limited to 300 chunks and 200,000 indexed characters (including overlap); exceeding either limit shows an error rather than silently dropping sources. AI SDK structured output is Zod-validated, thinking is disabled with `reasoning: "none"`, and each attempt is limited to 2,500 output tokens and 45 seconds. Invalid structured output gets one automatic retry; other failures require a user retry. No tools or external lookup are enabled.

Materials are managed only inside their course; there is no separate cross-course materials page. A failed outline leaves materials and embeddings ready; **Retry outline** calls `POST /api/courses/:id/outline` without re-indexing. These requests run synchronously, so keep the page open while generating. Interrupted generation claims can be reclaimed after five minutes by clicking **Check generation**. This is not a background job queue.

Adding, removing, or re-indexing material increments the course's `source_version` through a database trigger. The old outline remains visible and is marked out of date; click **Update outline** after the source changes are complete. Current outlines are reused without another model call. Manual outline editing remains out of scope. Deleting a material removes only its files and chunks, not its course or lessons. Course deletion is not exposed; its foreign key restricts deletion while it still has material files to clean up.

An atomic database claim prevents overlapping active attempts. Publication uses a Neon HTTP `db.batch` transaction: lock the course, delete previous lessons, insert the replacement lessons, and update the outline version. Every statement is guarded by the owner, course, generation token, and source version. The trigger takes the same course row lock, so source changes cannot be published as current. Failed publication rolls back to the previous outline; stale workers cannot overwrite a newer attempt. The old per-material generation endpoint has been removed.

Interactive tutoring and assessment are available from each lesson. A saved assessment score of at least 70 completes a lesson. Viewing an outline or chatting alone does not mark it complete.

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
- Once the first Gateway call starts, an attempt consumes the daily allowance even if generation fails or the client disconnects, because embedding/provider work may be billable. Known failures before any Gateway call release their reservation. The daily limit is shared across sessions and resets at midnight UTC.
- Adding, deleting, or re-indexing sources makes existing sessions read-only. Regenerating the outline detaches the replaced lesson IDs but **preserves sessions and messages**. Find them under **Recent conversations** on the course page. Start a new current lesson to continue tutoring with the new sources.

Iteration 9 below extends the original daily tutor reservation with a per-call usage ledger, ingestion quotas, and shared rolling limits. Assessments and **Finish lesson** are described in Iteration 8 below.

### Tutor smoke test

1. Apply the migration, start the app, and open a course containing at least two indexed materials.
2. Start a lesson and select **Begin lesson**. Verify that text streams and a single opening question appears.
3. Reply, ask for a hint, and open **Sources**. Check the filename/page/excerpt against your uploaded material.
4. Reload or navigate away and return: both sides of the conversation should remain.
5. Open the session URL as another user: access should be denied. The same applies to message and source endpoints.
6. Add a source and update the outline: the old conversation should remain readable, with new sends disabled.

Automated tests use a fake streaming provider and execute the Neon HTTP adapter's SQL in isolated PostgreSQL. They cover persistence, failures, disconnects, duplicate requests, lease recovery, source-version races, ownership, daily rollover/concurrent quota reservations, and UTF-8 stream framing. Live provider quality and browser interaction still require the smoke test above; no tests send real learner content or incur model charges.

## Assessment and progress (Iteration 8)

**Before opening the app:** stop the dev server, run `pnpm db:migrate`, then restart with `pnpm dev`. The new `0006_lesson_assessments.sql` migration is additive: it creates assessment history without modifying existing courses, materials, sessions, or messages. Apply it to the target Neon branch before deploying the new app. No additional secrets or services are required. Generating the migration locally does not apply it to Neon.

After at least two completed tutor exchanges, select **Finish lesson** below the conversation. This is a formative review of the learner's saved answers, not a separate generated quiz. Questions and tutor explanations alone are not evidence of mastery; the prompt asks for conservative scoring when evidence is missing. The result contains a 0–100 integer mastery estimate, strengths, knowledge gaps, and a recommended next step. AI scoring can still be wrong; this is not a formal grade.

### Completion rules

- A validated, persisted score **≥70** completes the current lesson. A lower score keeps it available for practice.
- Continue the conversation and finish again for another attempt. All results and failed attempts are retained; the history Accordion has newer/older pagination.
- Finishing an unchanged conversation reuses its successful result without another embedding/model request. Failed attempts may be retried with a fresh request ID.
- Any passing attempt counts once per lesson. A later lower score does not revoke completion or inflate progress.
- Course progress is `round(completed current lessons / total current lessons × 100)`, with 0% for an empty outline. It is calculated from saved results, not a model-generated percentage, and appears on both the course page and course cards.
- Changing sources invalidates current progress. Updating the outline creates new lesson IDs with fresh progress. Older assessments remain with their read-only conversations; they never transfer automatically to revised lessons.

### Request walkthrough

1. The session Server Component loads owned history and deterministic completion. A small Client Component handles Finish, loading/error states, and pagination; the course pages stay Server Components.
2. The browser posts **only a request ID** to `/api/tutor/sessions/:id/assessments`. The Route Handler authenticates, validates the session ID/body, and rejects client-supplied scores, owners, sources, or history.
3. The service loads the latest 20 messages from **completed, paired exchanges**, requires at least two exchanges, and atomically claims the same two-minute session lease as tutor sends. A sequence guard rejects a conversation that changed while preparing. Assessment and chat cannot run concurrently within a session.
4. Retrieval selects the six closest owned chunks from the current course using the lesson objective/query. Empty retrieval fails without grading. Lesson metadata, conversation, and sources are explicitly untrusted JSON data; no web/tools are enabled.
5. Qwen generates Zod-validated structured output with **reasoning disabled, a 1,000-output-token cap, no automatic retries, and a 60-second timeout** covering retrieval and generation. Invalid or truncated output never grants completion. Prompt constraints are not a guarantee against model mistakes or prompt injection.
6. A Neon HTTP `db.batch` transaction locks the course and session, checks ownership, source/outline versions, and claim token, then saves the result plus evidence message/chunk IDs and releases the lease. Failed attempts expose safe errors without private provider details. Expired attempts can be reclaimed; late workers cannot save completion or release a newer lease.
7. The client reloads saved history and refreshes the Server Component data. A lost connection may interrupt the request: refresh history before retrying. Assessment is bounded synchronous work, not a durable background job.

The 30-turn quota remains specific to tutor messages; assessments do not consume it. Successful unchanged transcripts are reused, requests have bounded context/output/time, and the configured Gateway key spend cap still applies. Iteration 9 adds usage/cost recording and a shared rolling AI endpoint limit, including repeated failed assessment requests.

### Assessment smoke test

1. Apply the migration, start the app, and open an existing lesson. Its earlier conversation must still be present.
2. Complete at least two exchanges, including your own explanation. Select **Finish lesson** and check the score, strengths, gaps, and next step.
3. If the score is below 70, practice and assess again. Both attempts should remain. A score of 70 or higher should show **Lesson complete**, and the course/card should advance by exactly one lesson.
4. Finish again without chatting: the same result should be reused. Add a completed exchange and finish again: a new result should appear without double-counting progress.
5. Reload the session and course. Progress/history should persist. Check a second account cannot read history or submit assessment for this session.
6. Add a source and update the outline. The old conversation/assessment should stay readable, but its pass must not complete a new lesson.

Automated tests use fake AI providers and isolated PGlite PostgreSQL through the actual Neon HTTP adapter. They cover the 69/70 boundary, retries/history/reuse, input and output validation, failed/truncated generation, empty retrieval, ownership, source changes, lease recovery, stale publication, persistence failure, migration constraints, and deterministic progress. They do not apply production migrations, send real learner content to providers, or validate live model grading quality.

## Usage accounting and rate limits (Iteration 9)

### Rollout

Stop the old app, run `pnpm db:migrate`, then restart with `pnpm dev`. Apply the migration to each deployment's Neon branch before deploying the updated code. `0008_usage_accounting.sql` adds the usage ledger, quota reservations, rolling request windows, and an ingestion counter on the existing `tutor_daily_usage` table. Existing tutor counts, chunks, vectors, source versions, and progress are preserved. **No re-embedding is needed.** Historical costs are not backfilled or guessed.

The existing `AI_GATEWAY_API_KEY` is required for every app AI call. The app refuses to fall back silently to deployment OIDC without the dedicated key. In the Vercel AI Gateway dashboard, verify that this specific key has a **$5 monthly spend quota** and that **auto-top-up is disabled**. These account settings cannot be inferred or enforced by a local environment variable; no credits are purchased and no account settings are changed by the application.

### What gets recorded

`src/lib/usage/gateway.ts` wraps every app Gateway call: document/query embeddings, each outline attempt, tutor streams, and assessments. Each call inserts a durable `pending` event before contacting the provider, then finalizes it with:

- Authenticated owner, feature, model, and a logical request ID (shared by retrieval and generation).
- Input, output, cache-read, reasoning, and total tokens when reported by AI SDK v7. Cached and reasoning counts are already included in totals; do not add them again.
- Gateway-operation latency and first text/reasoning-token latency for streams. Non-streaming first-token latency is null.
- Actual USD cost from `providerMetadata.gateway.cost`, stored as `numeric(24,18)`, and the Gateway generation ID when supplied. Unknown cost remains null, distinct from a reported zero. See [Gateway response cost metadata](https://vercel.com/academy/ai-gateway/ai-gateway-pricing).
- Success/failure and a safe error code. No prompts, responses, source text, Blob URLs, credentials, or raw provider metadata are stored in the usage ledger.

Structured-output retries have separate events and retain cost metadata even for invalid JSON. A successful Gateway call can still be followed by an application/database failure; the ledger describes the Gateway operation, not course publication. The stream continues being consumed after a browser disconnect using the existing `after` completion path. If initial accounting fails, no AI call starts. If final accounting fails or the process dies, the event remains pending/unknown for manual reconciliation; the app never repeats billable work to repair an accounting failure.

The embedding-maintenance CLI also records calls. It batches by owner for attribution; synthetic probe events have a null owner. Maintenance bypasses learner quotas, but not the Gateway key budget, and now requires migration 0008 even for `--probe`. It never resets course progress or learner counters.

### Limits and reservations

- **30 tutor turns per user per UTC day**, shared across sessions.
- **3 material ingestions per user per UTC day**, shared across courses. Uploading a Blob alone does not count; processing/indexing does. Quota denial leaves the material unchanged and returns HTTP 429.
- **5 valid AI endpoint requests per user per rolling 60 seconds**, shared across ingestion, outline, tutor, and assessment POSTs. Even saved-result replays count toward this short-window request limit, but do not make AI calls or consume another daily quota. Reading conversations/history does not count. Admin retrieval inspection is limited too.

Daily counters and reservation rows are created atomically before work begins. Immediately before the first Gateway call, the reservation is marked started. Extraction/validation/index-compatibility failures before any call release an unused reservation exactly once, against its original UTC day. Once any Gateway request starts, a timeout, 429, other provider failure, or disconnect does not refund the daily quota: billing may already have occurred. Process crashes are conservative; an unreleased reservation counts until the day's allowance resets. No job queue or automatic reconciliation worker is implied.

The database rolling limiter uses one bounded timestamp array per authenticated user and an atomic upsert, so concurrent requests and separate server instances cannot each spend the same slot. It always applies, including on localhost. Rate-limit responses include `Retry-After` and never trust a user-ID header or body field.

`AI_REQUESTS_PER_MINUTE` in `src/lib/usage/contracts.ts` configures **only this database limiter**. It does not create, update, or configure a Vercel Firewall rule. The Firewall request limit and time window are separate deployment settings and must be changed manually in the Vercel dashboard. Keep both limits aligned unless a deliberate stricter outer limit is wanted; a production request must pass both, so whichever limiter rejects first is the effective limit. The database uses an exact rolling 60-second window, while Vercel's non-Enterprise fixed-window rule can reset at a window boundary.

### Vercel Firewall setup (manual)

The SDK integration is implemented, but **installing the package does not publish a Firewall rule**. Following [Vercel's Rate Limiting SDK setup](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk):

1. Open the project's **Firewall → Configure → New Rule**. Select the **`@vercel/firewall`** condition with rate-limit ID `tutor-ai`.
2. Set its rate limit to **5 requests per 60 seconds**, with rate-limited requests denied. Review and publish the rule. Check feature availability/pricing for your Vercel plan before enabling it; this implementation does not upgrade the account.
3. Set `VERCEL_FIREWALL_RATE_LIMIT_ID=tutor-ai` in the matching Vercel deployment environments, then redeploy. This variable only selects the published rule by ID; it does **not** copy `AI_REQUESTS_PER_MINUTE` or any other limit into Vercel. The server supplies the authenticated user ID as `rateLimitKey`; don't add a client-controlled user header condition.
4. For Preview, follow Vercel's Protection Bypass for Automation/system-environment-variable requirements. Test the published rule in Preview before Production. Leave the setting empty locally; the database guard still enforces the rolling limit.

When configured in production, a missing/unreachable rule fails closed with 503; a rate-limited request receives 429. The SDK prefers the trusted public application domain because generated deployment URLs can be inaccessible under Deployment Protection, and it logs a safe configuration error without user or request data when the check fails. The database check remains active too, providing exact rolling-window enforcement independent of the Firewall's configured algorithm.

### Checkpoint and smoke test

Trace a tutor request through the authenticated Route Handler, shared rolling limit, session claim, daily reservation, embedding event, streaming tutor event, and saved answer. Compare `request_id` to group its two Gateway calls. Quotas count a learner turn once; usage counts each actual call separately.

After applying the migration, send one normal tutor message and inspect its two `ai_usage_events` rows in Neon/Drizzle Studio. Reconcile their model, generation ID, token counts, and reported USD cost with the Gateway dashboard; do not treat missing metadata as zero. Then use the mocked automated tests to reproduce 429s without spending credits. Test real Firewall rejection in Preview after publishing the rule. No live AI calls or production Firewall changes are part of automated tests.

## Quotas and admin analytics (Iteration 10)

No migration is required for this iteration. The views read the Iteration 9 ledger and daily counters directly in dynamic Server Components; there is no public analytics API and no paid Custom Reporting API dependency.

Learners see only two daily quota cards on `/app`: tutor turns and material ingestion. The learner query reads the current user's daily counters and does not select request history, model IDs, Gateway generation IDs, error codes, or monetary cost. There is no learner usage page.

Allowlisted administrators can open `/admin` for a read-only, date-filtered view containing aggregate requests, tokens, average latency, failures, and actual known USD cost; breakdowns by UTC day, user, model, and feature; highest-usage learners; recent safe failure categories; and paginated request history. Request history has server-side user-email and model search, feature/status filters, and sorting, so it does not load a dropdown containing every user. These request-table controls do not change the dashboard aggregates. Every admin analytics query enters through `getAdminAnalytics`, which executes `requireAdmin()` before any database read. Unknown provider costs remain visibly distinct from a reported zero, and all aggregates come from locally persisted Gateway metadata for reconciliation with the Gateway dashboard.

The admin page includes loading, narrow-screen table overflow, status, and pagination states. Automated analytics tests verify quota reads, admin authorization, date scoping, and user filtering. The next iteration is production hardening and the final end-to-end release pass.
