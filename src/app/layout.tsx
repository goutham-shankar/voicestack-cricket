import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Voicestack Cricket League",
    template: "%s · Voicestack Cricket League",
  },
  description: "Live cricket player auction management platform",
  applicationName: "Voicestack Cricket League",
  manifest: "/manifest.webmanifest",
  // Icons come from the app/ file conventions (icon.png, apple-icon.png,
  // favicon.ico) — declaring them here as well would override those.
  appleWebApp: {
    capable: true,
    title: "VCL Auction",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#4a3ce1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="top-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
