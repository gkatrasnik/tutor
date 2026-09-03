"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown, LogOut, Moon, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import { signOutAction } from "@/lib/auth/actions";

const menuItemClass =
  "flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm text-foreground/80 outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground";

const subscribeToHydration = () => () => undefined;

export function AccountMenu({
  displayName,
  email,
  initials,
  showAdmin,
}: {
  displayName: string;
  email: string;
  initials: string;
  showAdmin: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  const darkMode = mounted && resolvedTheme === "dark";

  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex max-w-64 items-center gap-2 rounded-xl p-1 pl-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
        aria-label="Open account menu"
      >
        <span className="max-w-36 truncate text-sm font-medium text-foreground/80 sm:max-w-52">
          {displayName}
        </span>
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials || "TU"}
          </AvatarFallback>
        </Avatar>
        <ChevronDown
          className="mr-1 size-4 text-muted-foreground/70"
          aria-hidden="true"
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          sideOffset={8}
          align="end"
          className="z-50 outline-none"
        >
          <Menu.Popup className="w-64 origin-[var(--transform-origin)] rounded-xl border border-border bg-card p-1.5 shadow-lg outline-none transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.CheckboxItem
              checked={darkMode}
              disabled={!mounted}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
              closeOnClick={false}
              className={`${menuItemClass} justify-between`}
            >
              <span className="flex items-center gap-2">
                <Moon className="size-4" aria-hidden="true" />
                Dark mode
              </span>
              <span
                className="flex h-5 w-9 items-center rounded-full bg-muted px-0.5 ring-1 ring-foreground/10 transition-colors data-[checked]:bg-primary"
                data-checked={darkMode ? "" : undefined}
                aria-hidden="true"
              >
                <span
                  className="size-4 rounded-full bg-card shadow-sm transition-transform data-[checked]:translate-x-4"
                  data-checked={darkMode ? "" : undefined}
                />
              </span>
            </Menu.CheckboxItem>
            {showAdmin ? (
              <Menu.LinkItem
                render={<Link href="/admin" />}
                closeOnClick
                className={menuItemClass}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Admin
              </Menu.LinkItem>
            ) : null}
            <Menu.Separator className="my-1 h-px bg-border" />
            <form action={signOutAction}>
              <Menu.Item
                nativeButton
                render={<button type="submit" />}
                className={`${menuItemClass} w-full text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive`}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Menu.Item>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
