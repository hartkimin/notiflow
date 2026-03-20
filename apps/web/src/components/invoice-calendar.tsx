"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { TaxInvoiceDetail, TaxInvoiceStatus } from "@/lib/tax-invoice/types";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  draft: { label: "임시", variant: "secondary" },
  issued: { label: "발행", variant: "default" },
  sent: { label: "전송", variant: "outline", className: "text-blue-600" },
  cancelled: { label: "취소", variant: "destructive" },
  modified: { label: "수정", variant: "outline" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function formatAmount(n: number | null | undefined) {
  if (n == null || n === 0) return "";
  return `₩${Math.round(n).toLocaleString()}`;
}

function StatusBadge({ status }: { status: TaxInvoiceStatus }) {
  const st = STATUS_MAP[status];
  if (!st) return null;
  return <Badge variant={st.variant} className={`text-[9px] px-1 py-0 h-3.5 shrink-0 ${st.className ?? ""}`}>{st.label}</Badge>;
}

// --- Renderers ---

function MonthItem({ inv }: { inv: TaxInvoiceDetail }) {
  return (
    <span>
      <span className="font-medium">{inv.invoice_number}</span>{" "}
      {inv.buyer_name}
      {inv.total_amount ? <span className="text-[10px] text-muted-foreground ml-1">{formatAmount(inv.total_amount)}</span> : null}
    </span>
  );
}

function WeekItem({ inv }: { inv: TaxInvoiceDetail }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium font-mono truncate">{inv.invoice_number}</span>
        <StatusBadge status={inv.status} />
      </div>
      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{inv.buyer_name}</p>
      <div className="flex items-center justify-between gap-1 mt-0.5">
        {inv.total_amount ? <span className="text-[10px] font-medium tabular-nums">{formatAmount(inv.total_amount)}</span> : null}
        <span className="text-[9px] text-muted-foreground">{inv.items.length}품목</span>
      </div>
    </div>
  );
}

function DayItem({ inv }: { inv: TaxInvoiceDetail }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium font-mono">{inv.invoice_number}</span>
        <StatusBadge status={inv.status} />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{inv.buyer_name}</span>
        <span>작성일: {formatDate(inv.issue_date)}</span>
      </div>

      {inv.items.length > 0 && (
        <div className="border rounded text-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] py-1 h-auto">품목</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-12">수량</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">단가</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">공급가액</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-14">세액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-[11px] py-0.5 truncate max-w-[120px]">{item.item_name}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.unit_price?.toLocaleString() ?? "-"}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.supply_amount?.toLocaleString() ?? "-"}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.tax_amount?.toLocaleString() ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs">
        <span>공급가액 <strong className="tabular-nums">{formatAmount(inv.supply_amount)}</strong></span>
        <span>세액 <strong className="tabular-nums">{formatAmount(inv.tax_amount)}</strong></span>
        <span>합계 <strong className="tabular-nums">{formatAmount(inv.total_amount)}</strong></span>
      </div>
    </div>
  );
}

function DetailContent({ inv }: { inv: TaxInvoiceDetail }) {
  const st = STATUS_MAP[inv.status];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">발행번호</span>
          <p className="font-medium font-mono">{inv.invoice_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground">상태</span>
          <p>{st && <Badge variant={st.variant} className={st.className}>{st.label}</Badge>}</p>
        </div>
        <div>
          <span className="text-muted-foreground">공급자</span>
          <p className="font-medium">{inv.supplier_name}</p>
        </div>
        <div>
          <span className="text-muted-foreground">공급받는자</span>
          <p className="font-medium">{inv.buyer_name}</p>
        </div>
        <div>
          <span className="text-muted-foreground">작성일자</span>
          <p className="font-medium">{formatDate(inv.issue_date)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">공급일자</span>
          <p className="font-medium">
            {inv.supply_date ? formatDate(inv.supply_date) :
             inv.supply_date_from ? `${formatDate(inv.supply_date_from)} ~ ${formatDate(inv.supply_date_to)}` : "-"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">공급가액</span>
          <p className="font-medium">{formatAmount(inv.supply_amount)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">세액</span>
          <p className="font-medium">{formatAmount(inv.tax_amount)}</p>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">합계금액</span>
          <p className="font-bold text-lg">{formatAmount(inv.total_amount)}</p>
        </div>
      </div>

      {inv.items.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">품목 ({inv.items.length}건)</h4>
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs py-1 h-auto w-8">순번</TableHead>
                  <TableHead className="text-xs py-1 h-auto">품목명</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-14">수량</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">단가</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">공급가액</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-16">세액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs py-1 text-center">{item.item_seq}</TableCell>
                    <TableCell className="text-xs py-1">{item.item_name}</TableCell>
                    <TableCell className="text-xs py-1 text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-xs py-1 text-right tabular-nums">{item.unit_price?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell className="text-xs py-1 text-right tabular-nums">{item.supply_amount?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell className="text-xs py-1 text-right tabular-nums">{item.tax_amount?.toLocaleString() ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {inv.linked_orders.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">연결된 주문</h4>
          <div className="space-y-1">
            {inv.linked_orders.map((lo) => (
              <a key={lo.order_id} href={`/orders/${lo.order_id}`} className="text-sm text-primary hover:underline block">
                {lo.order_number} {lo.amount ? `(${formatAmount(lo.amount)})` : ""}
              </a>
            ))}
          </div>
        </div>
      )}

      {inv.remarks && (
        <div>
          <h4 className="text-sm font-medium mb-1">비고</h4>
          <div className="rounded border p-3 text-sm bg-muted/30">{inv.remarks}</div>
        </div>
      )}

      <div className="pt-2">
        <a href={`/invoices/${inv.id}`} className="text-sm text-primary hover:underline">
          상세 페이지로 이동 →
        </a>
      </div>
    </div>
  );
}

// --- Main component ---

interface InvoiceCalendarProps {
  initialView: CalendarView;
  initialDate: Date;
  invoices: TaxInvoiceDetail[];
}

export function InvoiceCalendar({ initialView, initialDate, invoices }: InvoiceCalendarProps) {
  return (
    <DataCalendar
      items={invoices}
      dateAccessor={(inv) => new Date(inv.issue_date)}
      idAccessor={(inv) => inv.id}
      renderMonthItem={(inv) => <MonthItem inv={inv} />}
      renderWeekItem={(inv) => <WeekItem inv={inv} />}
      renderDayItem={(inv) => <DayItem inv={inv} />}
      renderDetail={(inv) => <DetailContent inv={inv} />}
      detailTitle={(inv) => `세금계산서 ${inv.invoice_number}`}
      initialView={initialView}
      initialDate={initialDate}
      basePath="/invoices"
      tabParam="calendar"
    />
  );
}
