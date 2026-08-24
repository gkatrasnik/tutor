# Tutor

Tutor turns a learner's private PDF or pasted text into a focused course and a grounded, Socratic tutoring experience.

This repository currently contains **Iteration 1: Foundation** from the implementation plan.

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

Database, authentication, private storage, and AI credentials will be added in their corresponding iterations rather than placing unused secrets in this foundation.
