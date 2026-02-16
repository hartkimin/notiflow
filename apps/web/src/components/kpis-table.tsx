"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { markReportedAction } from "@/app/(dashboard)/kpis/actions";
import { toast } from "sonner";
import type { KpisReport } from "@/lib/types";

export function KpisTable({ reports, title }: { reports: KpisReport[]; title: string }) {
  const [dialogId, setDialogId] = useState<number | null>(null);
  const [refNum, setRefNum] = useState("");

  async function handleSubmit() {
    if (!dialogId) return;
    try {
      await markReportedAction(dialogId, refNum);
      toast.success("신고 처리되었습니다.");
      setDialogId(null);
      setRefNum("");
    } catch {
      toast.error("신고 처리에 실패했습니다.");
    }
  }

  return (
    <>
      <h3 className="text-base font-medium mb-2">{title} ({reports.length}건)</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>주문품목 ID</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>생성일</TableHead>
            <TableHead>참조번호</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">항목이 없습니다.</TableCell>
            </TableRow>
          ) : (
            reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.order_item_id}</TableCell>
                <TableCell>
                  <Badge variant={r.report_status === "pending" ? "secondary" : "default"}>
                    {r.report_status === "pending" ? "대기" : "완료"}
                  </Badge>
                </TableCell>
                <TableCell>{r.created_at?.slice(0, 10)}</TableCell>
                <TableCell>{r.reference_number || "-"}</TableCell>
                <TableCell>
                  {r.report_status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => setDialogId(r.id)}>
                      신고처리
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogId !== null} onOpenChange={() => setDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>KPIS 신고 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm">참조번호</label>
            <Input
              value={refNum}
              onChange={(e) => setRefNum(e.target.value)}
              placeholder="KPIS 신고 참조번호 입력"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogId(null)}>취소</Button>
            <Button onClick={handleSubmit}>신고완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
