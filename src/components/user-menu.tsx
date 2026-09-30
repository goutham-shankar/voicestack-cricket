"use client";

import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  name,
  role,
}: {
  name: string;
  role: "admin" | "auctioneer" | "team";
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="flex items-center gap-2 px-2 h-10" />}
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary/15 text-primary text-xs">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="capitalize text-xs text-muted-foreground">
            {role} account
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
          <span className="hidden dark:inline">Light mode</span>
          <span className="dark:hidden">Dark mode</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
