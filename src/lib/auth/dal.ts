import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { env } from "@/lib/env";

import { isAdminEmail, normalizeEmail } from "./authorization";
import { getAuth } from "./server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

export const requireUser = cache(async (): Promise<CurrentUser> => {
  const { data, error } = await getAuth().getSession();

  if (error || !data?.user?.id || !data.user.email) {
    redirect("/auth/sign-in");
  }

  const email = normalizeEmail(data.user.email);

  await db
    .insert(profiles)
    .values({
      id: data.user.id,
      email,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email,
        updatedAt: new Date(),
      },
    });

  return {
    id: data.user.id,
    email,
    name: data.user.name ?? null,
  };
});

export const requireAdmin = cache(async () => {
  const user = await requireUser();

  if (!isAdminEmail(user.email, env.ADMIN_EMAILS)) {
    redirect("/app");
  }

  return user;
});
