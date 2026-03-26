"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { cancelInvoice, issueInvoice, deleteInvoice } from "@/lib/tax-invoice/service";
import type { TaxInvoice } from "@/lib/tax-invoice/types";

interface InvoiceTableProps {
  invoices: TaxInvoice[];
}

export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<TaxInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TaxInvoice | null>(null);

  function handleCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error("취소 사유를 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        await cancelInvoice(cancelTarget.id, cancelReason.trim());
        toast.success(`${cancelTarget.invoice_number} 취소 완료`);
        setCancelTarget(null);
        setCancelReason("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "취소 처리 중 오류가 발생했습니다.");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteInvoice(deleteTarget.id);
        toast.success(`${deleteTarget.invoice_number} 삭제 완료`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 처리 중 오류가 발생했습니다.");
      }
    });
  }

  function handleReissue(invoice: TaxInvoice) {
    startTransition(async () => {
      try {
        await issueInvoice(invoice.id);
        toast.success(`${invoice.invoice_number} 재발행 완료`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "재발행 처리 중 오류가 발생했습니다.");
      }
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        세금계산서가 없습니다.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>발행번호</TableHead>
            <TableHead>작성일자</TableHead>
            <TableHead>거래처</TableHead>
            <TableHead className="text-right">공급가액(VAT별도)</TableHead>
            <TableHead className="text-right">세액</TableHead>
            <TableHead className="text-right">합계(VAT포함)</TableHead>
            <TableHead className="w-[90px]">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const supply = invoice.supply_amount > 0
              ? invoice.supply_amount
              : Math.round(invoice.total_amount / 1.1);
            const tax = invoice.tax_amount > 0
              ? invoice.tax_amount
              : invoice.total_amount - supply;
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
                  ₩{supply.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  ₩{tax.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₩{invoice.total_amount.toLocaleString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                  <div className="flex h-6 rounded-md border bg-muted/40 p-0.5 w-fit">
                    <button
                      type="button"
                      disabled={isPending || invoice.status === "issued"}
                      onClick={() => invoice.status === "cancelled" && handleReissue(invoice)}
                      className={`px-2 text-[10px] font-semibold rounded-sm transition-colors ${
                        invoice.status === "issued" || invoice.status === "draft" || invoice.status === "sent"
                          ? "bg-green-100 text-green-700 shadow-sm"
                          : "text-muted-foreground hover:text-green-700"
                      }`}
                    >
                      완료
                    </button>
                    <button
                      type="button"
                      disabled={isPending || invoice.status === "cancelled"}
                      onClick={() => invoice.status !== "cancelled" && setCancelTarget(invoice)}
                      className={`px-2 text-[10px] font-semibold rounded-sm transition-colors ${
                        invoice.status === "cancelled"
                          ? "bg-red-100 text-red-600 shadow-sm"
                          : "text-muted-foreground hover:text-red-600"
                      }`}
                    >
                      취소
                    </button>
                  </div>
                  {invoice.status === "cancelled" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-500"
                      title="삭제"
                      disabled={isPending}
                      onClick={() => setDeleteTarget(invoice)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>세금계산서 취소</DialogTitle>
            <DialogDescription>
              {cancelTarget?.invoice_number} ({cancelTarget?.buyer_name})를 취소합니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="취소 사유를 입력하세요..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(""); }} disabled={isPending}>
              닫기
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? "처리 중..." : "취소 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>세금계산서 삭제</DialogTitle>
            <DialogDescription>
              {deleteTarget?.invoice_number} ({deleteTarget?.buyer_name})를 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              닫기
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "처리 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
