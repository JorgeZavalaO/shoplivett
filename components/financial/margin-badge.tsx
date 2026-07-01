import { Badge } from "@/components/ui/badge";
import {
  classifyMarginBps,
  classifyMarginPercent,
  formatBpsPercent,
  formatPercent,
  marginLabel,
  type MarginLevel,
} from "@/lib/financial-ui";

type Props =
  | { bps: number; percent?: never; showValue?: boolean }
  | { percent: number; bps?: never; showValue?: boolean };

const CLASSNAME: Record<MarginLevel, string> = {
  loss: "bg-destructive/10 text-destructive border-destructive/20",
  low: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  medium: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200",
  high: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
};

export function MarginBadge(props: Props) {
  const level = "bps" in props && typeof props.bps === "number"
    ? classifyMarginBps(props.bps)
    : classifyMarginPercent(props.percent);
  const value = "bps" in props && typeof props.bps === "number"
    ? formatBpsPercent(props.bps)
    : formatPercent(props.percent);
  return (
    <Badge variant="outline" className={CLASSNAME[level]}>
      {marginLabel(level)}
      {props.showValue === false ? null : ` · ${value}`}
    </Badge>
  );
}
