import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  phase,
  icon: Icon,
}: {
  title: string;
  description: string;
  phase: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <Icon className="size-4" />
            Coming in {phase}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This section is scaffolded and routed, ready to be built out.
        </CardContent>
      </Card>
    </div>
  );
}
