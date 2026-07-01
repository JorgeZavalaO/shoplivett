import { Badge } from "@/components/ui/badge";
import {
  batchHealthLabel,
  classifyBatchHealth,
  formatBpsPercent,
  type BatchHealthLevel,
} from "@/lib/financial-ui";

type Props = {
  status?: string;
  marginBps?: number;
  roiBps?: number;
  availableUnits?: number;
  showValue?: boolean;
};

const CLASSNAME: Record<BatchHealthLevel, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  loss: "bg-destructive/10 text-destructive border-destructive/20",
  low: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  medium: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200",
  high: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
};

export function BatchHealthBadge({
  status,
  marginBps,
  roiBps,
  availableUnits,
  showValue = true,
}: Props) {
  const level = classifyBatchHealth({ status, marginBps, roiBps, availableUnits });
  const basis = typeof marginBps === "number" ? marginBps : roiBps;
  return (
    <Badge variant="outline" className={CLASSNAME[level]}>
      {batchHealthLabel(level)}
      {showValue && typeof basis === "number" ? ` · ${formatBpsPercent(basis)}` : null}
    </Badge>
  );
}
