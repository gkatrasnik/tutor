import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { AppNavigation } from "@/components/app-navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/authorization";
import { requireUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const showAdmin = isAdminEmail(user.email, env.ADMIN_EMAILS);
  const displayName = user.name?.trim() || user.email;
  const initials = displayName
    .split(/\s+|@/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-52 truncate text-sm text-stone-500 sm:inline">
              {displayName}
            </span>
            <Avatar className="size-9">
              <AvatarFallback className="bg-emerald-100 text-emerald-800">
                {initials || "TU"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[90rem]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r bg-white p-4 md:flex">
          <nav className="space-y-1" aria-label="App navigation">
            <AppNavigation showAdmin={showAdmin} />
          </nav>
          <div className="mt-auto">
            <Separator className="mb-4" />
            <Link
              href="/app/settings"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100"
            >
              <Settings className="size-4" aria-hidden="true" />
              Settings
            </Link>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                className="mt-1 w-full justify-start text-stone-600"
              >
                <LogOut aria-hidden="true" />
                Sign out
              </Button>
            </form>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <nav
            className="flex gap-1 overflow-x-auto border-b bg-white px-4 py-2 md:hidden"
            aria-label="Mobile app navigation"
          >
            <AppNavigation mobile showAdmin={showAdmin} />
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
