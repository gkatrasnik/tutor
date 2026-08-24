# Tutor

Tutor turns a learner's private PDF or pasted text into a focused course and a grounded, Socratic tutoring experience.

This repository currently contains **Iterations 1–2: Foundation and Neon database discipline** from the implementation plan.

## Start locally

Requirements: Node.js 20.9+ and pnpm.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The learner-shell preview is at `/app`; the admin-shell preview is at `/admin`. Authentication and route protection are intentionally deferred to Iteration 3.

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

## App Router structure

Route groups organize code without changing URLs:

```text
src/app/
├── (public)/page.tsx               → /
├── (authenticated)/app/            → /app
├── (admin)/admin/                   → /admin
├── globals.css
└── layout.tsx
```

Pages and layouts are Server Components unless a file explicitly begins with `"use client"`. The first slice needs no application-owned Client Components. Interactive shadcn/ui primitives create small client boundaries only where their underlying accessible primitive requires one.

shadcn/ui components live in `src/components/ui`. They are source-owned: the application can inspect, test, and adapt them instead of depending on a black-box component package.

## Deploy to Vercel

1. Push this repository to a Git provider.
2. Import it into Vercel as a Next.js project.
3. Copy the values from `.env.example` into the Vercel project settings and set `NEXT_PUBLIC_APP_URL` to the production origin.
4. Deploy. Every branch or pull request receives a preview deployment; changes on the production branch promote through the production deployment lifecycle.

Authentication, private storage, and AI credentials will be added in their corresponding iterations rather than placing unused secrets in the current foundation.
