import Link from "next/link";
import { TrendingUp, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardKpis, getYearlyKpis } from "@/lib/queries/dashboard-stats";
import { getSalesRepDetail, getSalesRepHospitalDetail, getHospitalDetail, getHospitalItemDetail, getOrderDetail, getProductPerformance } from "@/lib/queries/sales-stats";
import { SalesRepSection } from "@/components/sales/sales-rep-section";
import { HospitalSection } from "@/components/sales/hospital-section";
import { ProductSection } from "@/components/sales/product-section";
import { OrderSection } from "@/components/sales/order-section";

function fmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

function getMonthOffset(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function SalesPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = params.month || currentMonth;
  const prevMonth = getMonthOffset(selectedMonth, -1);
  const nextMonth = getMonthOffset(selectedMonth, 1);
  const isCurrentMonth = selectedMonth === currentMonth;
  const selectedYear = params.year ? parseInt(params.year) : now.getFullYear();

  const [kpis, yearKpis, salesReps, repHospitals, hospitals, hospItems, products, orders] = await Promise.all([
    getDashboardKpis(selectedMonth).catch(() => null),
    getYearlyKpis(selectedYear).catch(() => null),
    getSalesRepDetail(selectedMonth).catch(() => []),
    getSalesRepHospitalDetail(selectedMonth).catch(() => []),
    getHospitalDetail(selectedMonth).catch(() => []),
    getHospitalItemDetail(selectedMonth).catch(() => []),
    getProductPerformance(selectedMonth).catch(() => []),
    getOrderDetail(selectedMonth).catch(() => []),
  ]);

  return (
    <>
      {/* ── KPI Bar ── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-0 overflow-x-auto text-sm">
            {/* Year */}
            {yearKpis && (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/sales?year=${selectedYear - 1}&month=${selectedMonth}`}><ChevronLeft className="h-3 w-3" /></Link>
                  </Button>
                  <span className="text-[11px] font-bold min-w-[40px] text-center">{yearKpis.year}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/sales?year=${selectedYear + 1}&month=${selectedMonth}`}><ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-muted-foreground text-xs">매출</span>
                  <span className="font-bold text-xs">₩{fmt(yearKpis.revenue)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">이익</span>
                  <span className={`font-bold text-xs ${yearKpis.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(yearKpis.profit)}</span>
                  <span className="text-[10px] text-muted-foreground">{yearKpis.profitMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">주문</span>
                  <span className="font-bold text-xs">{yearKpis.orderCount}건</span>
                </div>
              </>
            )}
            <div className="h-4 w-px bg-border shrink-0 mx-3" />
            {/* Month */}
            {kpis && (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/sales?month=${prevMonth}&year=${selectedYear}`}><ChevronLeft className="h-3 w-3" /></Link>
                  </Button>
                  {isCurrentMonth ? (
                    <span className="text-[11px] font-bold min-w-[35px] text-center">{parseInt(selectedMonth.slice(5))}월</span>
                  ) : (
                    <Link href="/sales" className="text-[11px] font-bold min-w-[35px] text-center hover:underline">{parseInt(selectedMonth.slice(5))}월</Link>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/sales?month=${nextMonth}&year=${selectedYear}`}><ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  <span className="text-muted-foreground text-xs">매출</span>
                  <span className="font-bold text-xs">₩{fmt(kpis.monthlyRevenue)}</span>
                  {kpis.revenueGrowth >= 0 ? (
                    <span className="text-[10px] text-green-600">▲{kpis.revenueGrowth.toFixed(1)}%</span>
                  ) : (
                    <span className="text-[10px] text-red-500">▼{Math.abs(kpis.revenueGrowth).toFixed(1)}%</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">이익</span>
                  <span className={`font-bold text-xs ${kpis.monthlyProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(kpis.monthlyProfit)}</span>
                  <span className="text-[10px] text-muted-foreground">{kpis.monthlyProfitMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">주문</span>
                  <span className="font-bold text-xs">{kpis.monthlyOrderCount}건</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Sections ── */}
      <SalesRepSection initialData={salesReps} initialHospitalData={repHospitals} initialMonth={selectedMonth} />
      <HospitalSection initialData={hospitals} initialItemData={hospItems} initialMonth={selectedMonth} />
      <ProductSection initialData={products} initialMonth={selectedMonth} />
      <OrderSection initialData={orders} initialMonth={selectedMonth} />
    </>
  );
}
