import { BarChart3, BookOpen, Library, Settings } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { href: "/app", label: "Courses", icon: BookOpen },
  { href: "/app/materials", label: "Materials", icon: Library },
  { href: "/app/usage", label: "Usage", icon: BarChart3 },
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-500 sm:inline">Learner preview</span>
            <Avatar className="size-9">
              <AvatarFallback className="bg-emerald-100 text-emerald-800">LP</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[90rem]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r bg-white p-4 md:flex">
          <nav className="space-y-1" aria-label="App navigation">
            {navigation.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={index === 0
                  ? "flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900"
                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto">
            <Separator className="mb-4" />
            <Link href="/app/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100">
              <Settings className="size-4" aria-hidden="true" />
              Settings
            </Link>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <nav className="flex gap-1 overflow-x-auto border-b bg-white px-4 py-2 md:hidden" aria-label="Mobile app navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
