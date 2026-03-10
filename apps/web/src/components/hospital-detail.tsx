"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Plus, Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  updateHospital,
  addHospitalItems,
  updateHospitalItem,
  removeHospitalItem,
  updateHospitalMarginRate,
  searchFavoriteItems,
} from "@/lib/actions";
import { ItemPickerModal } from "@/components/item-picker-modal";
import type { Hospital, HospitalItemWithPricing } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  hospital: "병원",
  clinic: "의원",
  pharmacy: "약국",
  distributor: "유통사",
  research: "연구소",
  other: "기타",
};

interface Props {
  hospital: Hospital;
  items: HospitalItemWithPricing[];
  defaultMarginRate: number;
}

export function HospitalDetail({ hospital, items, defaultMarginRate }: Props) {
  return (
    <div className="space-y-6">
      <HospitalInfoCard hospital={hospital} defaultMarginRate={defaultMarginRate} />
      <HospitalItemsCard hospital={hospital} items={items} defaultMarginRate={defaultMarginRate} />
    </div>
  );
}

// --- Basic Info Card (editable) ---

function HospitalInfoCard({
  hospital,
  defaultMarginRate,
}: {
  hospital: Hospital;
  defaultMarginRate: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(hospital.name);
  const [shortName, setShortName] = useState(hospital.short_name || "");
  const [hospitalType, setHospitalType] = useState(hospital.hospital_type || "hospital");
  const [phone, setPhone] = useState(hospital.phone || "");
  const [businessNumber, setBusinessNumber] = useState(hospital.business_number || "");
  const [address, setAddress] = useState(hospital.address || "");
  const [contactPerson, setContactPerson] = useState(hospital.contact_person || "");
  const [paymentTerms, setPaymentTerms] = useState(hospital.payment_terms || "");
  const [marginRate, setMarginRate] = useState(String(defaultMarginRate));

  function handleCancel() {
    setName(hospital.name);
    setShortName(hospital.short_name || "");
    setHospitalType(hospital.hospital_type || "hospital");
    setPhone(hospital.phone || "");
    setBusinessNumber(hospital.business_number || "");
    setAddress(hospital.address || "");
    setContactPerson(hospital.contact_person || "");
    setPaymentTerms(hospital.payment_terms || "");
    setMarginRate(String(defaultMarginRate));
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateHospital(hospital.id, {
          name,
          short_name: shortName || null,
          hospital_type: hospitalType,
          phone: phone || null,
          business_number: businessNumber || null,
          address: address || null,
          contact_person: contactPerson || null,
          payment_terms: paymentTerms || null,
        });
        const rate = parseFloat(marginRate);
        if (!isNaN(rate)) {
          await updateHospitalMarginRate(hospital.id, rate);
        }
        toast.success("거래처 정보가 수정되었습니다.");
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
          <CardDescription>거래처 상세 정보</CardDescription>
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
              <Label>거래처명</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>약칭</Label>
              <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>유형</Label>
              <select
                value={hospitalType}
                onChange={(e) => setHospitalType(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                {Object.entries(TYPE_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>전화번호</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>사업자번호</Label>
              <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>담당자</Label>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>주소</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>결제조건</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>기본 마진율 (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={marginRate}
                onChange={(e) => setMarginRate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <InfoField label="거래처명" value={hospital.name} />
            <InfoField label="약칭" value={hospital.short_name} />
            <InfoField label="유형" value={TYPE_LABEL[hospital.hospital_type] || hospital.hospital_type} />
            <InfoField label="전화번호" value={hospital.phone} />
            <InfoField label="사업자번호" value={hospital.business_number} />
            <InfoField label="담당자" value={hospital.contact_person} />
            <InfoField label="주소" value={hospital.address} className="sm:col-span-2" />
            <InfoField label="결제조건" value={hospital.payment_terms} />
            <InfoField label="기본 마진율" value={`${defaultMarginRate}%`} />
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd className="mt-0.5">
                <Badge variant={hospital.is_active ? "default" : "secondary"}>
                  {hospital.is_active ? "활성" : "비활성"}
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

// --- Hospital Items Card ---

function HospitalItemsCard({
  hospital,
  items,
  defaultMarginRate,
}: {
  hospital: Hospital;
  items: HospitalItemWithPricing[];
  defaultMarginRate: number;
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);

  function handleAddItems(ids: number[]) {
    startTransition(async () => {
      try {
        await addHospitalItems(hospital.id, ids);
        toast.success(`${ids.length}개 품목이 추가되었습니다.`);
        router.refresh();
      } catch (err) {
        toast.error(`품목 추가 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handleDeliveryPriceChange(itemId: number, value: string) {
    const price = value === "" ? null : Number(value);
    if (value !== "" && isNaN(price!)) return;
    startTransition(async () => {
      try {
        await updateHospitalItem(itemId, { delivery_price: price });
        router.refresh();
      } catch (err) {
        toast.error(`납품가 수정 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handleDelete(itemId: number) {
    startTransition(async () => {
      try {
        await removeHospitalItem(itemId);
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
            <CardTitle>납품 품목</CardTitle>
            <CardDescription>{items.length}개 품목 (기본 마진율: {defaultMarginRate}%)</CardDescription>
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
                    <TableHead className="w-24">유형</TableHead>
                    <TableHead className="w-28">공급가</TableHead>
                    <TableHead className="w-20 text-center">마진율</TableHead>
                    <TableHead className="w-36">납품가</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <HospitalItemRow
                      key={item.id}
                      item={item}
                      defaultMarginRate={defaultMarginRate}
                      onDeliveryPriceChange={handleDeliveryPriceChange}
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
          <p className="text-sm text-muted-foreground">이 품목을 거래처에서 제거하시겠습니까?</p>
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

function HospitalItemRow({
  item,
  defaultMarginRate,
  onDeliveryPriceChange,
  onDelete,
}: {
  item: HospitalItemWithPricing;
  defaultMarginRate: number;
  onDeliveryPriceChange: (id: number, value: string) => void;
  onDelete: () => void;
}) {
  const [localPrice, setLocalPrice] = useState(
    item.delivery_price != null ? String(item.delivery_price) : "",
  );

  const hasDeliveryOverride = item.delivery_price != null;
  const hasPrimarySupplier = item.primary_purchase_price != null;

  // Display price: override or computed
  const displayPrice = hasDeliveryOverride
    ? item.delivery_price!
    : item.computed_delivery_price;

  return (
    <TableRow>
      <TableCell className="text-sm font-medium">{item.item_name || "-"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{item.manufacturer || "-"}</TableCell>
      <TableCell>
        <Badge variant={item.source_type === "drug" ? "default" : "secondary"}>
          {item.source_type === "drug" ? "의약품" : "의료기기"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {hasPrimarySupplier ? (
          <span className="font-mono">
            {item.primary_purchase_price!.toLocaleString()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs">미등록</span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {defaultMarginRate}%
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            className="h-8 w-28"
            placeholder={
              displayPrice != null ? String(displayPrice) : "-"
            }
            value={localPrice}
            onChange={(e) => setLocalPrice(e.target.value)}
            onBlur={() => onDeliveryPriceChange(item.id, localPrice)}
          />
          {hasDeliveryOverride ? (
            <span className="text-xs font-bold whitespace-nowrap">
              {item.delivery_price!.toLocaleString()}
            </span>
          ) : displayPrice != null ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {displayPrice.toLocaleString()}
              </span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">자동</Badge>
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
