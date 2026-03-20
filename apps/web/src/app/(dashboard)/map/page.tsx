import { getMapPins } from "@/lib/queries/map-data";
import { MapWrapper } from "./map-wrapper";

export default async function MapPage() {
  const pins = await getMapPins();

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">파트너 지도</h1>
        <span className="text-sm text-muted-foreground">{pins.length}개 업체</span>
      </div>
      <MapWrapper pins={pins} />
    </>
  );
}
