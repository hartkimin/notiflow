"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapMarker } from "@/lib/queries/map-data";

const PartnerMap = dynamic(
  () => import("@/components/partner-map").then((m) => ({ default: m.PartnerMap })),
  { ssr: false, loading: () => <Skeleton className="h-[calc(100vh-14rem)] w-full rounded-lg" /> },
);

export function MapWrapper({ markers }: { markers: MapMarker[] }) {
  return <PartnerMap markers={markers} />;
}
