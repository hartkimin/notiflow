import { getPendingKpis, getOverdueKpis } from "@/lib/queries/reports";
import { KpisTable } from "@/components/kpis-table";
import { Card, CardContent } from "@/components/ui/card";

export default async function KpisPage() {
  const [pending, overdue] = await Promise.all([
    getPendingKpis().catch(() => ({ count: 0, reports: [] })),
    getOverdueKpis(7).catch(() => ({ count: 0, reports: [] })),
  ]);

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">KPIS 유통추적 신고</h1>
      </div>

      {overdue.count > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <KpisTable reports={overdue.reports} title="연체 항목 (7일 초과)" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <KpisTable reports={pending.reports} title="미신고 항목" />
        </CardContent>
      </Card>
    </>
  );
}
