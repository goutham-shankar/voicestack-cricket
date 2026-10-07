"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * Two tabs, because a team only ever does two things here: watch the auction
 * and check what it has left. Wallet and squad used to be their own pages,
 * which meant three navigations to answer one question.
 */
const navItems = [
  { href: "/team/auction", label: "Live Auction" },
  { href: "/team/dashboard", label: "My Team" },
];

export function TeamTopbar({
  name,
  teamName,
}: {
  name: string;
  teamName: string;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/60 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo size={28} />
          <p className="truncate text-sm font-semibold">{teamName}</p>
        </div>
        <UserMenu name={name} role="team" />
      </div>
      <nav className="flex gap-1 px-2 pb-2 md:px-6">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:text-left",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
