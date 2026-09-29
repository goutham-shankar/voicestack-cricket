"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ComponentProps } from "react";

export function SessionProvider(
  props: ComponentProps<typeof NextAuthSessionProvider>
) {
  return <NextAuthSessionProvider {...props} />;
}
