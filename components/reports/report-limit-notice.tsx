import type { ReportLimitMeta } from "@/lib/financial-reports";

export function ReportLimitNotice({ meta }: { meta: ReportLimitMeta }) {
  if (!meta.truncated) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      Mostrando los primeros <strong>{meta.returnedRows}</strong>
      {typeof meta.totalRows === "number" ? (
        <>
          {" "}de <strong>{meta.totalRows}</strong>
        </>
      ) : null}{" "}
      registros. Aplica filtros para acotar la consulta o el CSV.
    </div>
  );
}
