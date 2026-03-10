"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2 } from "lucide-react";

export interface PickerItem {
  id: number;
  source_type: string;
  item_name: string;
  manufacturer: string | null;
  standard_code: string | null;
}

type FilterType = "all" | "drug" | "device_std";

interface ItemPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ids: number[]) => void;
  excludeIds: number[];
  searchAction: (query: string) => Promise<PickerItem[]>;
}

export function ItemPickerModal({
  open,
  onOpenChange,
  onSelect,
  excludeIds,
  searchAction,
}: ItemPickerModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const excludeSet = new Set(excludeIds);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    startTransition(async () => {
      try {
        const data = await searchAction(query.trim());
        setResults(data);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      }
    });
  }, [query, searchAction]);

  const filtered = results.filter((item) => {
    if (excludeSet.has(item.id)) return false;
    if (filter === "all") return true;
    return item.source_type === filter;
  });

  function toggleItem(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onSelect(Array.from(selected));
    handleClose();
  }

  function handleClose() {
    setQuery("");
    setResults([]);
    setSelected(new Set());
    setSearched(false);
    setFilter("all");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>품목 추가</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2">
          <Input
            placeholder="품목명, 제조사, 표준코드로 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSearch} disabled={isPending || !query.trim()}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(
            [
              ["all", "전체"],
              ["drug", "의약품"],
              ["device_std", "의료기기"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto rounded-md border min-h-[200px] max-h-[400px]">
          {!searched ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              즐겨찾기 품목에서 검색합니다.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              검색 결과가 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>품목명</TableHead>
                  <TableHead>제조사</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>표준코드</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => toggleItem(item.id)}
                  >
                    <TableCell className="px-2">
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.item_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.manufacturer || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.source_type === "drug" ? "default" : "secondary"}>
                        {item.source_type === "drug" ? "의약품" : "의료기기"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {item.standard_code || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <span className="text-sm text-muted-foreground mr-auto">
            {selected.size > 0 && `${selected.size}개 선택됨`}
          </span>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
