import { getHospitals } from "@/lib/queries/hospitals";
import { HospitalTable } from "@/components/hospital-list";
import { Pagination } from "@/components/pagination";
import { RealtimeListener } from "@/components/realtime-listener";

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function HospitalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 15;
  const offset = (page - 1) * limit;

  const result = await getHospitals({
    search: params.search,
    limit,
    offset,
  }).catch(() => ({ hospitals: [], total: 0 }));

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <RealtimeListener tables={["hospitals"]} />
      
      {/* 
          HospitalTable now includes the Page Header, Search, 
          and Create Button in one efficient line.
      */}
      <div className="flex-1 flex flex-col min-h-0">
        <HospitalTable hospitals={result.hospitals} />
      </div>

      <div className="flex justify-end pt-2 border-t shrink-0">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={result.total}
        />
      </div>
    </div>
  );
}
