"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { TaxInvoice, TaxInvoiceStatus } from "@/lib/tax-invoice/types";

const STATUS_CONFIG: Record<
  TaxInvoiceStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  draft: { label: "임시", variant: "secondary" },
  issued: { label: "발행", variant: "default" },
  sent: { label: "전송", variant: "outline", className: "text-blue-600" },
  cancelled: { label: "취소", variant: "destructive" },
  modified: { label: "수정", variant: "outline" },
};

interface InvoiceTableProps {
  invoices: TaxInvoice[];
}

export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        세금계산서가 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>발행번호</TableHead>
          <TableHead>작성일자</TableHead>
          <TableHead>거래처</TableHead>
          <TableHead className="text-right">공급가액(VAT별도)</TableHead>
          <TableHead className="text-right">세액</TableHead>
          <TableHead className="text-right">합계(VAT포함)</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const statusCfg = STATUS_CONFIG[invoice.status];
          return (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {invoice.invoice_number}
                </Link>
              </TableCell>
              <TableCell>{invoice.issue_date}</TableCell>
              <TableCell>{invoice.buyer_name}</TableCell>
              <TableCell className="text-right">
                ₩{invoice.supply_amount.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                ₩{invoice.tax_amount.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-medium">
                ₩{invoice.total_amount.toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant={statusCfg.variant} className={statusCfg.className}>
                  {statusCfg.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
