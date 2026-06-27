// Route handler para exportar los reportes financieros a CSV (Sprint 25).
//
// Query params por seccion:
//   - sales:       from, to
//   - products:    from, to, categoryId, minUnits
//   - batches:     from, to
//   - stock:       categoryId, q
//   - rotation:    days, categoryId
//   - expenses:    year, month, category, type, status, q
//   - customers:   from, to, q
//   - returns:     from, to, type, status, decision
//
// Todos los handlers son dinamicos (no se cachean) porque los datos
// financieros no deben quedar obsoletos entre instancias serverless.

import { NextResponse, type NextRequest } from "next/server";

import { requireRole } from "@/lib/permissions";
import { buildCsv, csvFilename, type CsvColumn } from "@/lib/csv-export";
import {
  getBatchProfitabilityReport,
  getCustomersFinancialReport,
  getExpensesReport,
  getLowRotationReport,
  getProductProfitabilityReport,
  getReturnsLossesReport,
  getSalesByMonthReport,
  getStockValuationReport,
  type ReportDateRange,
} from "@/lib/financial-reports";
import { toCents } from "@/lib/money";

const SECTIONS = [
  "sales",
  "products",
  "batches",
  "stock",
  "rotation",
  "expenses",
  "customers",
  "returns",
] as const;
type Section = (typeof SECTIONS)[number];

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readRange(req: NextRequest): ReportDateRange {
  const url = new URL(req.url);
  return {
    from: parseDate(url.searchParams.get("from")),
    to: parseDateEnd(url.searchParams.get("to")),
  };
}

function csvResponse(section: Section, content: string) {
  const filename = csvFilename(`reporte-${section}`);
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) return notFound();
  await requireRole("ADMIN");
  const url = new URL(req.url);

  switch (section as Section) {
    case "sales":
      return runSalesReport(req);
    case "products":
      return runProductsReport(req);
    case "batches":
      return runBatchesReport(req);
    case "stock":
      return runStockReport(req);
    case "rotation":
      return runRotationReport(req);
    case "expenses":
      return runExpensesReport(req);
    case "customers":
      return runCustomersReport(req);
    case "returns":
      return runReturnsReport(req);
    default:
      return notFound();
  }

  function runSalesReport(reqArg: NextRequest) {
    const range = readRange(reqArg);
    return getSalesByMonthReport(range).then((report) => {
      type SalesCsvRow = {
        year: string;
        month: string;
        monthLabel: string;
        ordersCount: number;
        revenue: string;
        productCost: string;
        grossProfit: string;
        paymentFee: string;
        packagingCost: string;
        netProfit: string;
        marginBps: number;
      };
      const cols: Array<CsvColumn<SalesCsvRow>> = [
        { header: "Año", value: (r) => r.year },
        { header: "Mes", value: (r) => r.month },
        { header: "Periodo", value: (r) => r.monthLabel },
        { header: "Pedidos PAID", value: (r) => r.ordersCount },
        { header: "Ventas (PEN)", value: (r) => r.revenue },
        { header: "Costo (PEN)", value: (r) => r.productCost },
        { header: "Utilidad bruta (PEN)", value: (r) => r.grossProfit },
        { header: "Fee medio pago (PEN)", value: (r) => r.paymentFee },
        { header: "Costo empaque (PEN)", value: (r) => r.packagingCost },
        { header: "Utilidad neta (PEN)", value: (r) => r.netProfit },
        { header: "Margen (%)", value: (r) => (r.marginBps / 100).toFixed(2) },
      ];
      const totalPaymentFeeCents = report.rows.reduce(
        (acc, r) => acc + r.paymentFeeCents,
        0,
      );
      const totalPackagingCents = report.rows.reduce(
        (acc, r) => acc + r.packagingCostCents,
        0,
      );
      const data: SalesCsvRow[] = [
        ...report.rows.map((r) => ({
          year: String(r.year),
          month: String(r.month),
          monthLabel: r.monthLabel,
          ordersCount: r.ordersCount,
          revenue: r.revenue,
          productCost: r.productCost,
          grossProfit: r.grossProfit,
          paymentFee: r.paymentFee,
          packagingCost: r.packagingCost,
          netProfit: r.netProfit,
          marginBps: r.marginBps,
        })),
        {
          year: "",
          month: "",
          monthLabel: "TOTAL",
          ordersCount: report.totals.ordersCount,
          revenue: report.totals.revenue,
          productCost: report.totals.productCost,
          grossProfit: report.totals.grossProfit,
          paymentFee: (totalPaymentFeeCents / 100).toFixed(2),
          packagingCost: (totalPackagingCents / 100).toFixed(2),
          netProfit: report.totals.netProfit,
          marginBps:
            report.totals.revenueCents > 0
              ? Math.round((report.totals.netProfitCents * 10000) / report.totals.revenueCents)
              : 0,
        },
      ];
      const csv = buildCsv(data, cols);
      return csvResponse("sales", csv);
    });
  }

  function runProductsReport(reqArg: NextRequest) {
    const range = readRange(reqArg);
    const categoryId = url.searchParams.get("categoryId") || null;
    const minUnitsRaw = Number(url.searchParams.get("minUnits") ?? "1");
    const minUnits = Number.isFinite(minUnitsRaw) ? Math.max(0, Math.floor(minUnitsRaw)) : 1;
    return getProductProfitabilityReport(range, { categoryId, minUnits }).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Variante ID", value: (r) => r.variantId },
        { header: "Codigo", value: (r) => r.variantCode },
        { header: "Producto", value: (r) => r.productName },
        { header: "Categoria", value: (r) => r.categoryName },
        { header: "Color", value: (r) => r.color ?? "" },
        { header: "Unidades vendidas", value: (r) => r.unitsSold },
        { header: "Ingreso (PEN)", value: (r) => r.revenue },
        { header: "Costo (PEN)", value: (r) => r.cost },
        { header: "Utilidad bruta (PEN)", value: (r) => r.grossProfit },
        { header: "Margen (%)", value: (r) => (r.marginBps / 100).toFixed(2) },
        { header: "Stock", value: (r) => r.stock },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("products", csv);
    });
  }

  function runBatchesReport(reqArg: NextRequest) {
    const range = readRange(reqArg);
    return getBatchProfitabilityReport(range).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Lote", value: (r) => r.batchCode },
        { header: "Estado", value: (r) => r.status },
        { header: "Fecha compra", value: (r) => r.purchaseDate.toISOString().slice(0, 10) },
        { header: "Shopper", value: (r) => r.shopper ?? "" },
        { header: "Agencia", value: (r) => r.agency ?? "" },
        { header: "Inversion (PEN)", value: (r) => r.investment },
        { header: "Uds vendidas", value: (r) => r.soldUnits },
        { header: "Ingreso asignado (PEN)", value: (r) => r.allocatedRevenue },
        { header: "Costo asignado (PEN)", value: (r) => r.allocatedCost },
        { header: "Utilidad (PEN)", value: (r) => r.grossProfit },
        { header: "Margen (%)", value: (r) => (r.marginBps / 100).toFixed(2) },
        { header: "ROI (%)", value: (r) => (r.roiBps / 100).toFixed(2) },
        { header: "Uds disponibles", value: (r) => r.availableUnits },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("batches", csv);
    });
  }

  function runStockReport(reqArg: NextRequest) {
    void reqArg;
    const categoryId = url.searchParams.get("categoryId") || null;
    const query = url.searchParams.get("q") || undefined;
    return getStockValuationReport({ categoryId, query }).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Variante ID", value: (r) => r.variantId },
        { header: "Codigo", value: (r) => r.variantCode },
        { header: "Producto", value: (r) => r.productName },
        { header: "Categoria", value: (r) => r.categoryName },
        { header: "Color", value: (r) => r.color ?? "" },
        { header: "Talla", value: (r) => r.size ?? "" },
        { header: "Stock", value: (r) => r.stock },
        { header: "Reservado", value: (r) => r.reservedStock },
        { header: "Disponible", value: (r) => r.available },
        { header: "Origen costo", value: (r) => (r.hasBatches ? "Lote" : "Legado") },
        { header: "Costo unitario (PEN)", value: (r) => r.unitCost },
        { header: "Costo total (PEN)", value: (r) => r.totalCost },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("stock", csv);
    });
  }

  function runRotationReport(reqArg: NextRequest) {
    void reqArg;
    const daysRaw = Number(url.searchParams.get("days") ?? "60");
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.floor(daysRaw))) : 60;
    const categoryId = url.searchParams.get("categoryId") || null;
    return getLowRotationReport({ days, categoryId }).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Variante ID", value: (r) => r.variantId },
        { header: "Codigo", value: (r) => r.variantCode },
        { header: "Producto", value: (r) => r.productName },
        { header: "Categoria", value: (r) => r.categoryName },
        { header: "Color", value: (r) => r.color ?? "" },
        { header: "Stock", value: (r) => r.stock },
        { header: "Reservado", value: (r) => r.reservedStock },
        { header: "Vendido", value: (r) => r.soldStock },
        { header: "Valor stock (PEN)", value: (r) => r.stockValue },
        { header: "Ultima venta", value: (r) => r.lastSoldAt?.toISOString().slice(0, 10) ?? "Nunca" },
        { header: "Dias sin venta", value: (r) => r.daysSinceLastSale ?? "Nunca" },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("rotation", csv);
    });
  }

  function runExpensesReport(reqArg: NextRequest) {
    void reqArg;
    const year = Number(url.searchParams.get("year") ?? "");
    const month = Number(url.searchParams.get("month") ?? "");
    const category = url.searchParams.get("category") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const query = url.searchParams.get("q") || undefined;
    const safeYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined;
    const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined;
    return getExpensesReport({
      year: safeYear,
      month: safeMonth,
      category: category as never,
      type: type as never,
      status: status as never,
      query,
      page: 1,
      perPage: 1000,
    }).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Fecha", value: (r) => r.expenseDate.toISOString().slice(0, 10) },
        { header: "Categoria", value: (r) => r.categoryLabel },
        { header: "Tipo", value: (r) => r.expenseTypeLabel },
        { header: "Detalle", value: (r) => r.description },
        { header: "Monto (PEN)", value: (r) => r.amount },
        { header: "Medio de pago", value: (r) => r.paymentMethod ?? "" },
        { header: "Estado", value: (r) => r.status },
        { header: "Notas", value: (r) => r.notes ?? "" },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("expenses", csv);
    });
  }

  function runCustomersReport(reqArg: NextRequest) {
    const range = readRange(reqArg);
    const query = url.searchParams.get("q") || undefined;
    return getCustomersFinancialReport(range, { query }).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Cliente ID", value: (r) => r.customerId },
        { header: "Nombre", value: (r) => r.customerName },
        { header: "WhatsApp", value: (r) => r.whatsapp },
        { header: "Estado", value: (r) => r.status },
        { header: "Pedidos", value: (r) => r.ordersCount },
        { header: "Pedidos PAID", value: (r) => r.paidOrdersCount },
        { header: "Total facturado (PEN)", value: (r) => r.totalBilled },
        { header: "Cobrado (PEN)", value: (r) => r.totalPaid },
        { header: "Saldo pendiente (PEN)", value: (r) => r.totalPending },
        { header: "Credito disponible (PEN)", value: (r) => r.creditAvailable },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("customers", csv);
    });
  }

  function runReturnsReport(reqArg: NextRequest) {
    const range = readRange(reqArg);
    const type = url.searchParams.get("type") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const decision = url.searchParams.get("decision") || undefined;
    return getReturnsLossesReport(range, { type, status, decision }).then((report) => {
      const cols: Array<CsvColumn<(typeof report.rows)[number]>> = [
        { header: "Incidencia ID", value: (r) => r.incidentId },
        { header: "Fecha", value: (r) => r.incidentDate.toISOString().slice(0, 10) },
        { header: "Tipo", value: (r) => r.typeLabel },
        { header: "Estado", value: (r) => r.status },
        { header: "Decision", value: (r) => r.decisionLabel },
        { header: "Pedido", value: (r) => r.orderNumber ?? "" },
        { header: "Variante", value: (r) => r.variantCode ?? "" },
        { header: "Producto", value: (r) => r.productName ?? "" },
        { header: "Cliente", value: (r) => r.customerName ?? "" },
        { header: "Cantidad", value: (r) => r.quantity },
        { header: "Restock", value: (r) => r.restockQuantity },
        { header: "Recuperado (PEN)", value: (r) => r.recovered },
        { header: "Perdido (PEN)", value: (r) => r.lost },
        { header: "Descripcion", value: (r) => r.description },
      ];
      const csv = buildCsv(report.rows, cols);
      return csvResponse("returns", csv);
    });
  }
}

// Solo lectura. La conversion `toCents` no se usa directamente aqui pero
// se importa para tipar el helper y dejar el modulo preparado para
// futuras secciones que agreguen montos derivados en el CSV.
void toCents;
