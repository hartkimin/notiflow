import { getMapMarkers } from "@/lib/queries/map-data";
import { MapWrapper } from "./map-wrapper";

export default async function MapPage() {
  const markers = await getMapMarkers();

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">파트너 지도</h1>
        <span className="text-sm text-muted-foreground">
          {markers.length}개 업체 (주소 등록된 업체만 표시)
        </span>
      </div>
      <MapWrapper markers={markers} />
    </>
  );
}
