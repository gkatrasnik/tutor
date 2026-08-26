# Tutor

Tutor turns a learner's private PDF or pasted text into a focused course and a grounded, Socratic tutoring experience.

This repository currently contains **Iterations 1–5: Foundation, Neon database discipline, magic-link authentication, private material uploads, and Cohere-backed retrieval** from the implementation plan.

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
│   └── materials/                   → /app/materials
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
