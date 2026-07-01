import { Badge } from "@/components/ui/badge";
import {
  classifyIncidentImpact,
  incidentImpactLabel,
  type IncidentImpactLevel,
} from "@/lib/financial-ui";

const CLASSNAME: Record<IncidentImpactLevel, string> = {
  cancelled: "bg-muted text-muted-foreground border-border",
  neutral: "bg-muted text-foreground border-border",
  warning: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200",
  loss: "bg-destructive/10 text-destructive border-destructive/20",
  recovered: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
};

export function IncidentImpactBadge({
  status,
  lostCents,
  recoveredCents,
}: {
  status?: string;
  lostCents: number;
  recoveredCents: number;
}) {
  const level = classifyIncidentImpact({ status, lostCents, recoveredCents });
  return (
    <Badge variant="outline" className={CLASSNAME[level]}>
      {incidentImpactLabel(level)}
    </Badge>
  );
}
