import { Badge } from "@/components/ui/badge";
import {
  classifyStockHealth,
  stockHealthLabel,
  type StockHealthLevel,
} from "@/lib/financial-ui";

const CLASSNAME: Record<StockHealthLevel, string> = {
  out: "bg-destructive/10 text-destructive border-destructive/20",
  low: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  healthy: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
};

export function StockHealthBadge({ availableUnits }: { availableUnits: number }) {
  const level = classifyStockHealth(availableUnits);
  return (
    <Badge variant="outline" className={CLASSNAME[level]}>
      {stockHealthLabel(level)}
      {` · ${availableUnits}`}
    </Badge>
  );
}
