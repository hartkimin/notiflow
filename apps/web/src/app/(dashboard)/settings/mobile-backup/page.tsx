import { Layers, Filter, ListOrdered, MessageSquare } from "lucide-react";

import { getMobileSyncData } from "@/lib/queries/mobile-sync";
import { getDevices } from "@/lib/queries/devices";
import { StatCard } from "@/components/stat-card";
import { RestoreDeviceButton } from "@/components/restore-device-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function colorDot(color: number) {
  const hex = `#${(color >>> 0).toString(16).padStart(8, "0").slice(2)}`;
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-border shrink-0"
      style={{ backgroundColor: hex }}
    />
  );
}

export default async function MobileBackupPage() {
  const [syncData, { devices }] = await Promise.all([
    getMobileSyncData(),
    getDevices(),
  ]);

  const activeCategories = syncData.categories.filter((c) => !c.is_deleted);
  const activeFilterRules = syncData.filterRules.filter((r) => !r.is_deleted);
  const activeStatusSteps = syncData.statusSteps.filter((s) => !s.is_deleted);

  // Build category name map for filter rules display
  const categoryMap = new Map(syncData.categories.map((c) => [c.id, c.name]));

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">모바일 설정 백업</h2>
        <p className="text-sm text-muted-foreground mt-1">
          서버에 동기화된 모바일 앱 설정입니다. 앱 재설치 시 이 데이터를 복원할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
          title="카테고리"
          value={`${activeCategories.length}개`}
          icon={Layers}
          color="blue"
          description={syncData.categories.length !== activeCategories.length ? `삭제됨 ${syncData.categories.length - activeCategories.length}개 포함` : undefined}
        />
        <StatCard
          title="필터 규칙"
          value={`${activeFilterRules.length}개`}
          icon={Filter}
          color="green"
        />
        <StatCard
          title="상태 단계"
          value={`${activeStatusSteps.length}개`}
          icon={ListOrdered}
          color="purple"
        />
        <StatCard
          title="메시지"
          value={`${syncData.messageCount}개`}
          icon={MessageSquare}
          color="amber"
        />
      </div>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>카테고리 목록</CardTitle>
          <CardDescription>모바일 앱에서 사용 중인 카테고리입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">동기화된 카테고리가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>색상</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>순서</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCategories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>{colorDot(cat.color)}</TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{cat.order_index}</TableCell>
                    <TableCell>
                      <Badge variant={cat.is_active ? "default" : "secondary"}>
                        {cat.is_active ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Filter Rules */}
      <Card>
        <CardHeader>
          <CardTitle>필터 규칙</CardTitle>
          <CardDescription>알림 분류에 사용되는 필터 규칙입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeFilterRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">동기화된 필터 규칙이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>카테고리</TableHead>
                  <TableHead>발신자 키워드</TableHead>
                  <TableHead>포함 단어</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeFilterRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {categoryMap.get(rule.category_id) ?? rule.category_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rule.sender_keywords ?? []).map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rule.include_words ?? []).map((w, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{w}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Status Steps */}
      <Card>
        <CardHeader>
          <CardTitle>상태 단계</CardTitle>
          <CardDescription>알림 처리 상태를 나타내는 단계입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeStatusSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">동기화된 상태 단계가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>색상</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>순서</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStatusSteps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>{colorDot(step.color)}</TableCell>
                    <TableCell className="font-medium">{step.name}</TableCell>
                    <TableCell>{step.order_index}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Device Restore */}
      <Card>
        <CardHeader>
          <CardTitle>기기 복원</CardTitle>
          <CardDescription>
            등록된 기기에 서버 데이터 복원을 요청합니다. 앱이 실행 중이어야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 기기가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기기명</TableHead>
                  <TableHead>모델</TableHead>
                  <TableHead>앱 버전</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>복원</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.device_name}</TableCell>
                    <TableCell>{device.device_model ?? "-"}</TableCell>
                    <TableCell>{device.app_version}</TableCell>
                    <TableCell>
                      <Badge variant={device.is_active ? "default" : "secondary"}>
                        {device.is_active ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RestoreDeviceButton deviceId={device.id} deviceName={device.device_name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
