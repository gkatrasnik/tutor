# Tutor

Tutor turns a learner's private PDFs and pasted notes into a structured course with grounded, Socratic tutoring, lesson assessments, and progress tracking.

## Features

- Passwordless magic-link authentication with account-scoped courses and materials.
- Private PDF uploads and pasted text, with server-side extraction, validation, chunking, and vector indexing.
- AI-generated course outlines containing 4–8 ordered lessons, objectives, key concepts, and retrieval queries.
- Persistent Socratic tutoring grounded in passages retrieved from every indexed source in the course.
- Source citations with filenames, PDF page numbers, and excerpts.
- Formative lesson assessments with strengths, knowledge gaps, next steps, and deterministic progress tracking.
- Daily learner quotas, rolling request limits, AI token/cost accounting, and read-only admin analytics.
- Admin-only retrieval inspection and an email allowlist for administrative access.

Tutor is deliberately source-bound: course generation, tutoring, and assessment do not use web search or external tools. Model output can still be wrong, so learners should verify important claims against the displayed source passages.

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS and source-owned shadcn/ui components
- Neon Postgres, Drizzle ORM, and pgvector
- Neon Auth for magic-link sign-in
- Private Vercel Blob storage
- Vercel AI SDK and AI Gateway
- Vitest with isolated PGlite databases and Playwright browser checks

## Local development

Requirements: Node.js 22+ and pnpm 11.

```bash
cp .env.example .env.local
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/auth/sign-in`, use the learner application at `/app`, and open the allowlisted admin area at `/admin`.

### Commands

```bash
pnpm dev                  # Start the development server
pnpm build                # Create a production build
pnpm start                # Run the production build
pnpm test                 # Run the test suite
pnpm test:watch           # Run tests in watch mode
pnpm test:e2e:install     # Install Playwright Chromium once
pnpm test:e2e             # Run browser and security smoke tests
pnpm lint                 # Run ESLint
pnpm format:check         # Check formatting
pnpm format               # Format supported files
pnpm db:generate          # Generate a migration after a schema change
pnpm db:migrate           # Apply pending migrations
pnpm db:studio            # Open Drizzle Studio
pnpm embeddings:reembed   # Inspect or migrate stored embeddings
```

### VS Code debugging

Open **Run and Debug** (`Ctrl+Shift+D`), select **Next.js: debug full stack**, and press `F5`. VS Code starts the development server, waits for the app, and opens Chrome. Breakpoints work in Server Components, Route Handlers, and client components.

The other profiles in `.vscode/launch.json` support server-only debugging, browser-only debugging against an existing development server, and attaching to a server started with `pnpm dev --inspect`.

## Configuration

Copy `.env.example` to `.env.local` and provide the following values:

| Variable                        | Purpose                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | Public application origin, such as `http://localhost:3000`.                           |
| `DATABASE_URL`                  | Pooled Neon connection used by the application and maintenance scripts.               |
| `DATABASE_URL_UNPOOLED`         | Direct Neon connection preferred by Drizzle migrations; falls back to `DATABASE_URL`. |
| `BLOB_READ_WRITE_TOKEN`         | Token for the connected private Vercel Blob store.                                    |
| `AI_GATEWAY_API_KEY`            | Dedicated AI Gateway key used by all embedding and generation calls.                  |
| `TUTOR_MODEL`                   | Generation model. Defaults to `alibaba/qwen3.7-flash`.                                |
| `EMBEDDING_MODEL`               | Embedding model. Defaults to `openai/text-embedding-3-small`.                         |
| `EMBEDDING_DIMENSION`           | Vector dimension. Must remain `1536` with the current schema.                         |
| `ADMIN_EMAILS`                  | Comma-separated admin email allowlist; addresses are normalized to lowercase.         |
| `NEON_AUTH_BASE_URL`            | Branch-specific Neon Auth endpoint.                                                   |
| `NEON_AUTH_COOKIE_SECRET`       | Stable cookie secret of at least 32 characters.                                       |
| `VERCEL_FIREWALL_RATE_LIMIT_ID` | Optional published Vercel Firewall rule ID. Leave empty locally.                      |

Use the dedicated Tutor AI Gateway key in every environment and configure its spend quota in the Gateway dashboard. The application does not modify Gateway billing settings or silently fall back to deployment OIDC.

## Service setup

### Neon Postgres

Create a Neon database and set both database URLs. Apply all committed migrations before starting or deploying the app:

```bash
pnpm db:migrate
```

The migrations enable `pgvector`, create the application schema, define 1,536-dimensional embeddings, and add a cosine-distance HNSW index. In development, `/api/health/database` checks database connectivity and reports whether the vector extension is enabled; the route returns `404` in production.

For Vercel Preview deployments, enable Preview on the Neon Marketplace integration so each deployment receives branch-specific connection variables.

### Neon Auth

1. Enable Auth for the production branch in the Neon/Vercel integration.
2. Enable Magic Link sign-in and built-in email delivery in Neon Auth.
3. Add the local application origin as a trusted development origin. Vercel manages connected Preview and Production origins.
4. Set the same stable `NEON_AUTH_COOKIE_SECRET` in Local, Preview, and Production.
5. Configure `ADMIN_EMAILS`, pull the environment variables into `.env.local`, and redeploy.

The auth proxy performs an optimistic session check for `/app/**` and `/admin/**`. Server-only data access functions repeat authorization before reading private data, creating profiles, or granting admin access.

### Private Blob storage

Create a Vercel Blob store with **Private** access, connect it to the project, and expose `BLOB_READ_WRITE_TOKEN` in each environment.

PDFs upload directly from the browser with an authenticated, account-scoped upload token. Original files and extracted text remain private; the database records processing state and Blob references. Users can retry failed processing or permanently delete a material and its stored objects.

## How Tutor works

### Materials and retrieval

Each material belongs to an owned course. Tutor accepts:

- PDFs up to 5 MB and 50 pages. Encrypted, malformed, image-only, and oversized files are rejected.
- Pasted text up to 100,000 characters.

Processing normalizes the text, creates page-aware chunks of roughly 800 tokens with 100-token overlap, and indexes at most 150 chunks per material. Embeddings are generated in batches of 50. Retrieval selects the six closest compatible chunks and always filters by owner, course, material, and configured embedding model.

The current adapter supports `openai/text-embedding-3-small` and `cohere/embed-v4.0`; other models require an adapter. Source content is sent only to the configured provider and is not written to local logs.

### Courses and outlines

Learners create a named course, add one or more sources, and explicitly generate an outline. Outline generation combines all indexed course materials into a title, summary, and 4–8 lessons. Input is capped at 300 chunks and 200,000 indexed characters; Tutor reports an error instead of silently dropping sources.

Adding, removing, or re-indexing a source increments the course source version. The existing outline remains visible but is marked out of date until the learner generates an updated outline. Concurrent generation is guarded by an atomic database claim, and publication replaces lessons transactionally only when the owner and source version still match.

### Socratic tutoring

Starting a lesson creates or resumes a persistent session. For each learner message, Tutor retrieves relevant course passages, streams a short grounded explanation, and asks a focused question or offers a hint. The model receives trusted server-loaded conversation state, the latest 20 saved messages, and passages from all indexed materials in the course.

Completed conversations persist across navigation and reloads. Duplicate completed request IDs replay the saved result without another model call. If course sources change, existing sessions become read-only but remain available under **Recent conversations**.

### Assessments and progress

After at least two completed tutoring exchanges, **Finish lesson** evaluates the learner's saved answers. It returns a 0–100 mastery estimate, strengths, knowledge gaps, and a recommended next step. A saved score of 70 or higher completes the lesson.

Assessment history is retained, and unchanged successful assessments are reused. A later lower score does not revoke completion. Course progress is calculated from passing assessments for lessons in the current outline; replacing an outline creates new lesson IDs and fresh progress while preserving old conversations and assessments.

## Limits and usage accounting

Tutor enforces these application limits per authenticated learner:

- 30 tutor turns per UTC day.
- 3 material ingestions per UTC day.
- 5 AI endpoint requests in a rolling 60-second window, shared by ingestion, outline generation, tutoring, and assessment.

Daily reservations and rolling limits are stored atomically in Postgres and work locally as well as in deployed environments. Once a Gateway request starts, provider failures and disconnects do not refund its daily reservation because the call may be billable.

Every Gateway operation is recorded in `ai_usage_events`, including feature, model, logical request ID, status, reported token counts, latency, Gateway generation ID, and reported USD cost. Prompts, responses, source text, credentials, Blob URLs, and raw provider metadata are not stored. Missing provider cost remains unknown rather than being treated as zero.

Learners see only their daily tutor and ingestion quota cards. Allowlisted admins receive read-only, date-filtered aggregate and request-level analytics at `/admin`.

### Optional Vercel Firewall rule

The database limiter is always active. Production can add a second, outer limit using `@vercel/firewall`:

1. In **Firewall → Configure → New Rule**, select the `@vercel/firewall` condition and create a rule such as `tutor-ai`.
2. Set it to 5 requests per 60 seconds, deny rate-limited requests, and publish it.
3. Set `VERCEL_FIREWALL_RATE_LIMIT_ID` to that rule ID in the relevant Vercel environments and redeploy.

Publishing and pricing the Firewall rule are manual Vercel account operations. The environment variable selects an existing rule; it does not create or configure one. In production, a configured but unavailable rule fails closed.

## Changing the embedding model

The model label is stored with every chunk, and retrieval rejects missing or incompatible labels. To migrate existing chunks while preserving course content, lessons, conversations, citations, and progress:

1. Keep `EMBEDDING_DIMENSION=1536` and configure a supported `EMBEDDING_MODEL` in the target environment.
2. Pause ingestion and retrieval for every deployment sharing that database.
3. Run:

```bash
pnpm db:migrate
pnpm embeddings:reembed --dry-run
pnpm embeddings:reembed --probe
pnpm embeddings:reembed --apply
```

Dry-run performs no AI calls or writes. Probe performs one small billable request. Apply validates and atomically replaces mismatched embeddings; failures leave the original index intact and successful reruns skip already migrated chunks. The command targets exactly `DATABASE_URL`, processes all owners in that database, and is limited to 2,000 total chunks. Run it separately for other Neon branches, then deploy the app with the matching model configuration.

This command is different from retrying or re-indexing a material, which replaces chunks and advances the course source version.

## Application structure

Route groups organize the App Router without changing public URLs:

```text
src/app/
├── (public)/                      → landing page and authentication
├── (authenticated)/app/          → learner dashboard
│   ├── courses/[id]/             → course materials, outline, and progress
│   ├── sessions/[id]/            → persistent tutoring and assessment
│   └── materials/[id]/retrieval/ → admin-only retrieval inspector
├── (admin)/admin/                → usage and cost analytics
└── api/                           → auth, course, material, and tutor handlers
```

Pages and layouts are Server Components unless a file begins with `"use client"`. Client boundaries are limited to interactive forms, streaming chat, upload progress, notifications, and accessible UI primitives. Reusable shadcn/ui source lives in `src/components/ui`.

## Testing

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:e2e:install # first run on a machine only
pnpm test:e2e
```

The unit/integration suite uses fake AI and Blob providers and runs application SQL against isolated PGlite databases through the same database adapter used in production. Playwright starts a plain local Next.js development server and checks the landing page, unauthenticated `/app` and `/admin` redirects, and browser security headers. Set `E2E_BASE_URL` to run it against a Preview deployment instead.

Optional authenticated Playwright checks use saved browser state rather than an auth bypass. Save manually authenticated learner and admin states beneath the ignored `e2e/.auth/` directory, then set `PLAYWRIGHT_LEARNER_STATE` and `PLAYWRIGHT_ADMIN_STATE` to those file paths. Never commit storage-state files because they contain live session cookies. Magic-link delivery itself remains manual because it depends on an external mailbox and a single-use link.

Tests do not apply migrations to Neon, call live AI providers, validate live model quality, publish Firewall rules, change external account settings, or control an email inbox.

For an end-to-end smoke test, sign in, create a course, add at least two sources, generate an outline, complete a tutoring exchange, inspect its sources, finish an assessment, and verify progress. Repeat access checks with another account and confirm that direct course, session, and source URLs are denied.

## Production hardening

Every route receives a Content Security Policy plus `nosniff`, frame denial, strict referrer policy, restricted browser permissions, and cross-origin opener isolation. Production responses also receive two-year HSTS. Browser connections are limited to the app and Vercel Blob. Development alone permits `unsafe-eval` for Next.js debugging. The current non-nonce policy retains `unsafe-inline` for Next.js runtime scripts/styles; adopting per-request nonces would make every page dynamic and is a separate performance/security decision.

Unexpected route and background failures use structured JSON logs containing an event, timestamp, safe identifiers, bounded error type/code/status metadata, and a stack trace capped at 10,000 characters. Because stack traces include exception messages, provider or database errors can expose values embedded by those libraries; restrict production-log access and retention accordingly. Context associated with authorization, cookies, passwords, secrets, tokens, prompts, content, text, Blob data, URLs, or email is redacted. Never add prompts, learner messages, extracted material, private Blob locations, session cookies, or credentials to log context.

App, admin, and root error boundaries expose safe retry actions without rendering exception messages. Authenticated missing resources use the same response whether they were deleted or belong to another account. Courses, course details, sessions, and admin analytics have accessible loading states. Expected validation, quota, timeout, and provider failures remain explicit inline states.

Known v1 limitations: no OCR, DOCX, audio/video, web search, collaboration, billing, background ingestion queue, course editor, custom email delivery, or automated mailbox control. Settings is linked but not implemented. Retrieval inspection is admin-only. Material ingestion and AI generation are bounded synchronous operations; an interruption can require the documented lease-based retry.

## Deployment

1. Push the repository to a Git provider and import it as a Next.js project in Vercel.
2. Connect Neon Auth/Postgres and a private Vercel Blob store. Confirm Preview uses the intended isolated Neon branch and integration variables.
3. Configure all variables from `.env.example` for Development, Preview, and Production. Confirm the dedicated Gateway key still has the $5 monthly cap and auto-top-up disabled.
4. Apply migrations to the Preview database branch, inspect the output, then deploy the exact commit under review.
5. Run `pnpm test`, `pnpm lint`, `pnpm build`, and Playwright locally. Run Playwright again with `E2E_BASE_URL` targeting Preview and optional saved learner/admin states.
6. In Preview, complete the manual learner journey described above. Exercise database and Firewall 429 responses and confirm retry/timeout/error states.
7. Repeat ownership checks with a second account. Verify copied course, material, retrieval, session, source, and admin URLs reveal no cross-account data.
8. Reconcile one embedding and one generation request ID, model, tokens, latency, and actual cost with AI Gateway. Review logs for structured events and the absence of private content.
9. Promote the verified commit to Production, rerun public/header checks, and perform one minimal signed-in smoke test without reusing Preview data.

Each branch or pull request can receive a Vercel Preview deployment. Ensure the connected Neon and Blob integrations expose the intended branch/environment-specific credentials before relying on deployment isolation.
