import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/team/dashboard", label: "Dashboard" },
  { href: "/team/squad", label: "Squad" },
  { href: "/team/wallet", label: "Wallet" },
  { href: "/team/auction", label: "Live Auction" },
];

export function TeamTopbar({
  name,
  teamName,
}: {
  name: string;
  teamName: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/60 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={32} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{teamName}</p>
            <p className="text-xs text-muted-foreground">Team Dashboard</p>
          </div>
        </div>
        <UserMenu name={name} role="team" />
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 pb-2 pt-1 md:px-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
