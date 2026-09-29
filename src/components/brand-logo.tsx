import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  size = 32,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Voicestack Cricket League"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-lg", className)}
    />
  );
}
