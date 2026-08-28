"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown, LogOut, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOutAction } from "@/lib/auth/actions";

const menuItemClass =
  "flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm text-stone-700 outline-none select-none data-highlighted:bg-stone-100 data-highlighted:text-stone-950";

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
  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex max-w-64 items-center gap-2 rounded-xl p-1 pl-2 text-left outline-none transition-colors hover:bg-stone-100 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-stone-100"
        aria-label="Open account menu"
      >
        <span className="max-w-36 truncate text-sm font-medium text-stone-700 sm:max-w-52">
          {displayName}
        </span>
        <Avatar className="size-9">
          <AvatarFallback className="bg-emerald-100 text-emerald-800">
            {initials || "TU"}
          </AvatarFallback>
        </Avatar>
        <ChevronDown
          className="mr-1 size-4 text-stone-400"
          aria-hidden="true"
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          sideOffset={8}
          align="end"
          className="z-50 outline-none"
        >
          <Menu.Popup className="w-64 origin-[var(--transform-origin)] rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg outline-none transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-stone-950">
                {displayName}
              </p>
              <p className="truncate text-xs text-stone-500">{email}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-stone-200" />
            <Menu.LinkItem
              render={<Link href="/app/settings" />}
              closeOnClick
              className={menuItemClass}
            >
              <Settings className="size-4" aria-hidden="true" />
              Settings
            </Menu.LinkItem>
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
            <Menu.Separator className="my-1 h-px bg-stone-200" />
            <form action={signOutAction}>
              <Menu.Item
                render={<button type="submit" />}
                className={`${menuItemClass} w-full text-red-700 data-highlighted:bg-red-50 data-highlighted:text-red-800`}
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
