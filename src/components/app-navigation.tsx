"use client";

import { BarChart3, BookOpen, Library, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/app", label: "Courses", icon: BookOpen },
  { href: "/app/materials", label: "Materials", icon: Library },
  { href: "/app/usage", label: "Usage", icon: BarChart3 },
];

export function AppNavigation({
  mobile = false,
  showAdmin = false,
}: {
  mobile?: boolean;
  showAdmin?: boolean;
}) {
  const pathname = usePathname();
  const items = showAdmin
    ? [...navigation, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navigation;

  return items.map((item) => {
    const active =
      item.href === "/app"
        ? pathname === item.href ||
          pathname.startsWith("/app/courses/") ||
          pathname.startsWith("/app/sessions/")
        : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          mobile && "whitespace-nowrap rounded-lg py-2",
          active
            ? "bg-emerald-50 font-medium text-emerald-900"
            : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
        )}
      >
        <item.icon className="size-4" aria-hidden="true" />
        {item.label}
      </Link>
    );
  });
}
