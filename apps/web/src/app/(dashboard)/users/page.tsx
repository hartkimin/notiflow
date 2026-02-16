import { PlusCircle, Users, UserCheck, ShieldCheck, Eye } from "lucide-react";

import { getUsers } from "@/lib/queries/users";
import { UserTable } from "@/components/user-list";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function UsersPage() {
  const result = await getUsers().catch(() => ({ users: [], total: 0 }));
  const { users } = result;

  const activeCount = users.filter((u) => u.is_active).length;
  const adminCount =
    users.filter((u) => u.role === "admin" && u.is_active).length;
  const viewerCount =
    users.filter((u) => u.role === "viewer" && u.is_active).length;

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">사용자 관리</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              사용자 추가
            </span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
          title="전체 사용자"
          value={users.length}
          icon={Users}
          color="blue"
          description={`비활성 ${users.length - activeCount}명 포함`}
        />
        <StatCard title="활성 사용자" value={activeCount} icon={UserCheck} color="green" />
        <StatCard
          title="관리자"
          value={adminCount}
          icon={ShieldCheck}
          color="purple"
          description="모든 기능 접근"
        />
        <StatCard
          title="뷰어"
          value={viewerCount}
          icon={Eye}
          color="amber"
          description="조회 전용"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>
            대시보드 접근 계정을 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserTable users={users} />
        </CardContent>
      </Card>
    </>
  );
}
