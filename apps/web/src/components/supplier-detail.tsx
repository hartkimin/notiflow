"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  updateSupplier,
  addSupplierItems,
  updateSupplierItem,
  removeSupplierItem,
  searchFavoriteItems,
} from "@/lib/actions";
import { ItemPickerModal } from "@/components/item-picker-modal";
import type { Supplier, SupplierItem } from "@/lib/types";

interface Props {
  supplier: Supplier;
  items: SupplierItem[];
}

export function SupplierDetail({ supplier, items }: Props) {
  return (
    <div className="space-y-6">
      <SupplierInfoCard supplier={supplier} />
      <SupplierItemsCard supplier={supplier} items={items} />
    </div>
  );
}

// --- Basic Info Card (editable) ---

function SupplierInfoCard({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(supplier.name);
  const [shortName, setShortName] = useState(supplier.short_name || "");
  const [phone, setPhone] = useState(supplier.phone || "");
  const [businessNumber, setBusinessNumber] = useState(supplier.business_number || "");
  const [ceoName, setCeoName] = useState(supplier.ceo_name || "");
  const [fax, setFax] = useState(supplier.fax || "");
  const [address, setAddress] = useState(supplier.address || "");
  const [website, setWebsite] = useState(supplier.website || "");
  const [businessType, setBusinessType] = useState(supplier.business_type || "");
  const [businessCategory, setBusinessCategory] = useState(supplier.business_category || "");
  const [notes, setNotes] = useState(supplier.notes || "");

  function handleCancel() {
    setName(supplier.name);
    setShortName(supplier.short_name || "");
    setPhone(supplier.phone || "");
    setBusinessNumber(supplier.business_number || "");
    setCeoName(supplier.ceo_name || "");
    setFax(supplier.fax || "");
    setAddress(supplier.address || "");
    setWebsite(supplier.website || "");
    setBusinessType(supplier.business_type || "");
    setBusinessCategory(supplier.business_category || "");
    setNotes(supplier.notes || "");
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSupplier(supplier.id, {
          name,
          short_name: shortName || null,
          phone: phone || null,
          business_number: businessNumber || null,
          ceo_name: ceoName || null,
          fax: fax || null,
          address: address || null,
          website: website || null,
          business_type: businessType || null,
          business_category: businessCategory || null,
          notes: notes || null,
        });
        toast.success("공급사 정보가 수정되었습니다.");
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>공급사 상세 정보</CardDescription>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
              <X className="h-4 w-4 mr-1" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              <Save className="h-4 w-4 mr-1" /> {isPending ? "저장중..." : "저장"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> 수정
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>공급사명</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>약칭</Label>
              <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>대표자명</Label>
              <Input value={ceoName} onChange={(e) => setCeoName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>사업자등록번호</Label>
              <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>전화번호</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>팩스번호</Label>
              <Input value={fax} onChange={(e) => setFax(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>주소</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>홈페이지</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>업태</Label>
              <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>종목</Label>
              <Input value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>비고</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <InfoField label="공급사명" value={supplier.name} />
            <InfoField label="약칭" value={supplier.short_name} />
            <InfoField label="대표자명" value={supplier.ceo_name} />
            <InfoField label="사업자등록번호" value={supplier.business_number} />
            <InfoField label="전화번호" value={supplier.phone} />
            <InfoField label="팩스번호" value={supplier.fax} />
            <InfoField label="주소" value={supplier.address} className="sm:col-span-2" />
            <InfoField label="홈페이지" value={supplier.website} />
            <InfoField label="업태" value={supplier.business_type} />
            <InfoField label="종목" value={supplier.business_category} />
            <InfoField label="비고" value={supplier.notes} className="sm:col-span-2" />
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd className="mt-0.5">
                <Badge variant={supplier.is_active ? "default" : "secondary"}>
                  {supplier.is_active ? "활성" : "비활성"}
                </Badge>
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "-"}</dd>
    </div>
  );
}

// --- Supplier Items Card ---

function SupplierItemsCard({
  supplier,
  items,
}: {
  supplier: Supplier;
  items: SupplierItem[];
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);

  function handleAddItems(ids: number[]) {
    startTransition(async () => {
      try {
        await addSupplierItems(supplier.id, ids);
        toast.success(`${ids.length}개 품목이 추가되었습니다.`);
        router.refresh();
      } catch (err) {
        toast.error(`품목 추가 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handlePriceChange(itemId: number, value: string) {
    const price = value === "" ? null : Number(value);
    if (value !== "" && isNaN(price!)) return;
    startTransition(async () => {
      try {
        await updateSupplierItem(itemId, { purchase_price: price });
      } catch (err) {
        toast.error(`가격 수정 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handlePrimaryChange(itemId: number, checked: boolean) {
    startTransition(async () => {
      try {
        await updateSupplierItem(itemId, { is_primary: checked });
        router.refresh();
      } catch (err) {
        toast.error(`수정 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handleDelete(itemId: number) {
    startTransition(async () => {
      try {
        await removeSupplierItem(itemId);
        toast.success("품목이 제거되었습니다.");
        setDeleteItemId(null);
        router.refresh();
      } catch (err) {
        toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  const excludeIds = items.map((i) => i.mfds_item_id);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>취급 품목</CardTitle>
            <CardDescription>{items.length}개 품목</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowPicker(true)}>
            <Plus className="h-4 w-4 mr-1" /> 품목 추가
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              등록된 품목이 없습니다. 품목 추가 버튼을 눌러 추가하세요.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>품목명</TableHead>
                    <TableHead>제조사</TableHead>
                    <TableHead className="w-24">구분</TableHead>
                    <TableHead className="w-32">매입가</TableHead>
                    <TableHead className="w-24 text-center">주거래</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <SupplierItemRow
                      key={item.id}
                      item={item}
                      onPriceChange={handlePriceChange}
                      onPrimaryChange={handlePrimaryChange}
                      onDelete={() => setDeleteItemId(item.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ItemPickerModal
        open={showPicker}
        onOpenChange={setShowPicker}
        onSelect={handleAddItems}
        excludeIds={excludeIds}
        searchAction={searchFavoriteItems}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>품목 제거</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">이 품목을 공급사에서 제거하시겠습니까?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemId(null)}>취소</Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => deleteItemId && handleDelete(deleteItemId)}
            >
              {isPending ? "삭제중..." : "제거"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Individual item row ---

function SupplierItemRow({
  item,
  onPriceChange,
  onPrimaryChange,
  onDelete,
}: {
  item: SupplierItem;
  onPriceChange: (id: number, value: string) => void;
  onPrimaryChange: (id: number, checked: boolean) => void;
  onDelete: () => void;
}) {
  const [localPrice, setLocalPrice] = useState(
    item.purchase_price != null ? String(item.purchase_price) : "",
  );

  return (
    <TableRow>
      <TableCell className="text-sm font-medium">{item.item_name || "-"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{item.manufacturer || "-"}</TableCell>
      <TableCell>
        <Badge variant={item.source_type === "drug" ? "default" : "secondary"}>
          {item.source_type === "drug" ? "의약품" : "의료기기"}
        </Badge>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          className="h-8 w-28"
          placeholder="매입가"
          value={localPrice}
          onChange={(e) => setLocalPrice(e.target.value)}
          onBlur={() => onPriceChange(item.id, localPrice)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={item.is_primary}
          onCheckedChange={(checked: boolean) => onPrimaryChange(item.id, checked)}
        />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
