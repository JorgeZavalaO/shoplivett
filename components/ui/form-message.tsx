import { cn } from "@/lib/utils";

type FormMessageProps = {
  ok?: boolean;
  message?: string;
  className?: string;
};

export function FormMessage({ ok, message, className }: FormMessageProps) {
  return (
    <p
      className={cn(
        "text-sm",
        ok ? "text-emerald-600" : "text-destructive",
        !message && "text-transparent",
        className,
      )}
    >
      {message ?? "\u00B7"}
    </p>
  );
}
