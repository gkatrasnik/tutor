import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
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
          <Brand href="/app" />
          <AccountMenu
            displayName={displayName}
            email={user.email}
            initials={initials}
            showAdmin={showAdmin}
          />
        </div>
      </header>
      {children}
    </div>
  );
}
