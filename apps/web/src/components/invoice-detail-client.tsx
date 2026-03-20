"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type {
  TaxInvoiceDetail,
  TaxInvoiceStatus,
} from "@/lib/tax-invoice/types";
import {
  issueInvoice,
  cancelInvoice,
  deleteInvoice,
} from "@/lib/tax-invoice/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<
  TaxInvoiceStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    className?: string;
  }
> = {
  draft: { label: "임시", variant: "secondary" },
  issued: { label: "발행", variant: "default" },
  sent: { label: "전송", variant: "outline", className: "text-blue-600" },
  cancelled: { label: "취소", variant: "destructive" },
  modified: { label: "수정", variant: "outline" },
};

function formatBizNo(biz: string | null): string {
  if (!biz || biz.length !== 10) return biz || "-";
  return `${biz.slice(0, 3)}-${biz.slice(3, 5)}-${biz.slice(5)}`;
}

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return "₩0";
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ko-KR");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  invoice: TaxInvoiceDetail;
}

export default function InvoiceDetailClient({ invoice }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const status = STATUS_MAP[invoice.status];

  // -- Actions ---------------------------------------------------------------

  function handleIssue() {
    startTransition(async () => {
      try {
        await issueInvoice(invoice.id);
        toast.success("세금계산서가 발행 확정되었습니다.");
        setIssueOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "발행 처리 중 오류가 발생했습니다."
        );
      }
    });
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error("취소 사유를 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        await cancelInvoice(invoice.id, cancelReason.trim());
        toast.success("세금계산서가 취소되었습니다.");
        setCancelOpen(false);
        setCancelReason("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "취소 처리 중 오류가 발생했습니다."
        );
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteInvoice(invoice.id);
        toast.success("세금계산서 초안이 삭제되었습니다.");
        setDeleteOpen(false);
        router.push("/invoices");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "삭제 처리 중 오류가 발생했습니다."
        );
      }
    });
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === "draft" && (
            <>
              <Button onClick={() => setIssueOpen(true)} disabled={isPending}>
                발행 확정
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={isPending}
              >
                삭제
              </Button>
            </>
          )}
          {invoice.status === "issued" && (
            <>
              <Button variant="outline" asChild>
                <a
                  href={`/api/tax-invoice/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF 다운로드
                </a>
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setCancelOpen(true)}
                disabled={isPending}
              >
                취소
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cancellation notice */}
      {invoice.status === "cancelled" && invoice.remarks && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">
              <span className="font-semibold">취소 사유:</span> {invoice.remarks}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Supplier / Buyer info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">공급자 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <InfoRow label="상호" value={invoice.supplier_name} />
            <InfoRow
              label="사업자번호"
              value={formatBizNo(invoice.supplier_biz_no)}
            />
            <InfoRow label="대표자" value={invoice.supplier_ceo_name} />
            <InfoRow label="주소" value={invoice.supplier_address} />
            <InfoRow
              label="업태 / 종목"
              value={
                [invoice.supplier_biz_type, invoice.supplier_biz_item]
                  .filter(Boolean)
                  .join(" / ") || "-"
              }
            />
            <InfoRow label="이메일" value={invoice.supplier_email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">공급받는자 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <InfoRow label="상호" value={invoice.buyer_name} />
            <InfoRow
              label="사업자번호"
              value={formatBizNo(invoice.buyer_biz_no)}
            />
            <InfoRow label="대표자" value={invoice.buyer_ceo_name} />
            <InfoRow label="주소" value={invoice.buyer_address} />
            <InfoRow
              label="업태 / 종목"
              value={
                [invoice.buyer_biz_type, invoice.buyer_biz_item]
                  .filter(Boolean)
                  .join(" / ") || "-"
              }
            />
            <InfoRow label="이메일" value={invoice.buyer_email} />
          </CardContent>
        </Card>
      </div>

      {/* Dates */}
      <Card>
        <CardContent className="flex flex-wrap gap-6 pt-4 text-sm">
          <div>
            <span className="text-muted-foreground">작성일자</span>
            <p className="font-medium">{formatDate(invoice.issue_date)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">
              {invoice.supply_date_from ? "공급기간" : "공급일자"}
            </span>
            <p className="font-medium">
              {invoice.supply_date_from
                ? `${formatDate(invoice.supply_date_from)} ~ ${formatDate(invoice.supply_date_to)}`
                : formatDate(invoice.supply_date)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Amount summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">공급가액</p>
            <p className="text-lg font-medium">
              {formatAmount(invoice.supply_amount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">세액</p>
            <p className="text-lg font-medium">
              {formatAmount(invoice.tax_amount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">합계금액</p>
            <p className="text-lg font-bold">
              {formatAmount(invoice.total_amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">품목 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">순번</TableHead>
                <TableHead className="w-24">일자</TableHead>
                <TableHead>품명</TableHead>
                <TableHead>규격</TableHead>
                <TableHead className="w-20 text-right">수량</TableHead>
                <TableHead className="w-24 text-right">단가</TableHead>
                <TableHead className="w-28 text-right">공급가액</TableHead>
                <TableHead className="w-24 text-right">세액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    품목이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{item.item_seq}</TableCell>
                    <TableCell>{formatDate(item.item_date)}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.specification || "-"}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(item.supply_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(item.tax_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Linked orders */}
      {invoice.linked_orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">연결된 주문</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {invoice.linked_orders.map((lo) => (
                <li key={lo.order_id} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/orders/${lo.order_id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    주문번호: {lo.order_number}
                  </Link>
                  <span className="text-muted-foreground">
                    {formatAmount(lo.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Issue confirmation dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발행 확정</DialogTitle>
            <DialogDescription>
              세금계산서를 발행 확정하시겠습니까? 발행 후에는 수정할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button onClick={handleIssue} disabled={isPending}>
              {isPending ? "처리 중..." : "발행 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>초안 삭제</DialogTitle>
            <DialogDescription>
              이 초안을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "처리 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog with reason */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>세금계산서 취소</DialogTitle>
            <DialogDescription>
              취소 사유를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="취소 사유를 입력하세요..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelOpen(false);
                setCancelReason("");
              }}
              disabled={isPending}
            >
              닫기
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? "처리 중..." : "취소 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span>{value || "-"}</span>
    </div>
  );
}
