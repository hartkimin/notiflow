"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, MoreHorizontal, ArrowUp, ArrowDown, ArrowUpDown,
  LayoutList, LayoutGrid, UserPlus, ShieldCheck, Eye, UserX, UserCheck,
} from "lucide-react";
import { createUser, updateUser, deleteUser } from "@/lib/actions";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import type { DashboardUser } from "@/lib/types";

// -- Constants --

const USER_COL_DEFAULTS: Record<string, number> = {
  avatar: 50, email: 180, name: 120, role: 90, is_active: 80, created_at: 130, actions: 60,
};

type SortKey = "id" | "email" | "name" | "role" | "is_active" | "created_at";
type SortDir = "asc" | "desc";

// -- Helpers --

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(role: string) {
  return role === "admin"
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

// -- Main Component --

export function UserTable({ users }: { users: DashboardUser[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { widths, onMouseDown } = useResizableColumns("users", USER_COL_DEFAULTS);
  const [editItem, setEditItem] = useState<DashboardUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DashboardUser | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return sortDir === "asc" ? (av === bv ? 0 : av ? -1 : 1) : (av === bv ? 0 : av ? 1 : -1);
      }
      const cmp = String(av).localeCompare(String(bv), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  function handleDelete(user: DashboardUser) {
    startTransition(async () => {
      try {
        await deleteUser(user.id);
        setDeleteTarget(null);
        toast.success(`${user.name} 계정이 비활성화되었습니다.`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "비활성화 실패";
        if (msg.includes("last admin")) {
          toast.error("마지막 관리자 계정은 비활성화할 수 없습니다.");
        } else {
          toast.error(msg);
        }
      }
    });
  }

  function handleToggleActive(user: DashboardUser) {
    startTransition(async () => {
      try {
        if (user.is_active) {
          await deleteUser(user.id);
          toast.success(`${user.name} 계정이 비활성화되었습니다.`);
        } else {
          await updateUser(user.id, { is_active: true });
          toast.success(`${user.name} 계정이 활성화되었습니다.`);
        }
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "상태 변경 실패";
        if (msg.includes("last admin")) {
          toast.error("마지막 관리자 계정은 비활성화할 수 없습니다.");
        } else {
          toast.error(msg);
        }
      }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={view === "list" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
                <LayoutList className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>목록 보기</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={view === "grid" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setView("grid")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>카드 보기</TooltipContent>
          </Tooltip>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> 사용자 추가
        </Button>
      </div>

      {/* Empty state */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">등록된 사용자가 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">첫 사용자를 추가해주세요.</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> 사용자 추가
            </Button>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        /* --- List View --- */
        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed">
            <thead className="[&_tr]:border-b">
              <TableRow>
                <ResizableTh width={widths.avatar} colKey="avatar" onResizeStart={onMouseDown}>{/* avatar */}</ResizableTh>
                <ResizableTh width={widths.email} colKey="email" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("email")}>
                  <span className="inline-flex items-center">이메일<SortIcon active={sortKey === "email"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.name} colKey="name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center">이름<SortIcon active={sortKey === "name"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.role} colKey="role" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("role")}>
                  <span className="inline-flex items-center">역할<SortIcon active={sortKey === "role"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.is_active} colKey="is_active" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("is_active")}>
                  <span className="inline-flex items-center">상태<SortIcon active={sortKey === "is_active"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.created_at} colKey="created_at" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                  <span className="inline-flex items-center">생성일<SortIcon active={sortKey === "created_at"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.actions} colKey="actions" onResizeStart={onMouseDown}>{/* actions */}</ResizableTh>
              </TableRow>
            </thead>
            <TableBody>
              {sorted.map((u) => (
                <TableRow key={u.id} className={!u.is_active ? "opacity-50" : undefined}>
                  <TableCell>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className={`text-[10px] font-semibold ${getAvatarColor(u.role)}`}>
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium overflow-hidden text-ellipsis text-xs">{u.email}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">{u.name}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="gap-1">
                      {u.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {u.role === "admin" ? "관리자" : "뷰어"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.is_active}
                      disabled={isPending}
                      onCheckedChange={() => handleToggleActive(u)}
                      aria-label={u.is_active ? "비활성화" : "활성화"}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground overflow-hidden text-ellipsis">
                    {new Date(u.created_at).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(u)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> 수정
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {u.is_active ? (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(u)}>
                            <UserX className="h-3.5 w-3.5 mr-2" /> 비활성화
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                            <UserCheck className="h-3.5 w-3.5 mr-2" /> 활성화
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* --- Grid View --- */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((u) => (
            <Card key={u.id} className={!u.is_active ? "opacity-50" : undefined}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(u.role)}`}>
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm leading-tight">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditItem(u)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> 수정
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.is_active ? (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(u)}>
                          <UserX className="h-3.5 w-3.5 mr-2" /> 비활성화
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                          <UserCheck className="h-3.5 w-3.5 mr-2" /> 활성화
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="gap-1">
                    {u.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {u.role === "admin" ? "관리자" : "뷰어"}
                  </Badge>
                  <Badge variant={u.is_active ? "outline" : "secondary"}>
                    {u.is_active ? "활성" : "비활성"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  가입일: {new Date(u.created_at).toLocaleDateString("ko-KR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <UserFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="create"
      />

      {/* Edit Dialog */}
      {editItem && (
        <UserFormDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          mode="edit"
          user={editItem}
        />
      )}

      {/* Delete Confirmation (AlertDialog) */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자 비활성화</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) 계정을 비활성화하시겠습니까?
              비활성화된 계정은 로그인할 수 없지만, 다시 활성화할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {isPending ? "처리중..." : "비활성화"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// -- Form Dialog --

function UserFormDialog({
  open, onClose, mode, user,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  user?: DashboardUser;
}) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<string>(user?.role || "viewer");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isEdit = mode === "edit";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEdit && user) {
          const data: Record<string, unknown> = {
            name: fd.get("name") as string,
            role,
          };
          const password = fd.get("password") as string;
          if (password) data.password = password;
          await updateUser(user.id, data);
          toast.success(`${data.name} 사용자 정보가 수정되었습니다.`);
        } else {
          const name = fd.get("name") as string;
          await createUser({
            email: fd.get("email") as string,
            password: fd.get("password") as string,
            name,
            role,
          });
          toast.success(`${name} 사용자가 추가되었습니다.`);
        }
        onClose();
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장 실패";
        if (msg.includes("already exists") || msg.includes("23505") || msg.includes("already_exists")) {
          setError("이미 사용 중인 이메일입니다.");
        } else {
          setError(msg);
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "사용자 수정" : "새 사용자 추가"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "사용자 정보를 수정합니다. 비밀번호는 변경할 때만 입력하세요."
              : "대시보드에 접근할 새 사용자 계정을 생성합니다."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">이메일 {!isEdit && <span className="text-destructive">*</span>}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required={!isEdit}
                defaultValue={user?.email || ""}
                disabled={isEdit}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호 {!isEdit && <span className="text-destructive">*</span>}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required={!isEdit}
                placeholder={isEdit ? "변경시에만 입력" : "비밀번호를 입력하세요"}
                autoComplete="new-password"
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">비워두면 기존 비밀번호가 유지됩니다.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">이름 <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" required defaultValue={user?.name || ""} placeholder="표시될 이름" />
            </div>
            <div className="space-y-1.5">
              <Label>역할</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> 관리자
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> 뷰어
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "admin" ? "모든 기능에 접근 가능합니다." : "조회만 가능합니다."}
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장중..." : isEdit ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
