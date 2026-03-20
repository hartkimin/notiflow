"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapPin } from "@/components/partner-map";

const PartnerMap = dynamic(
  () => import("@/components/partner-map").then((m) => ({ default: m.PartnerMap })),
  { ssr: false, loading: () => <Skeleton className="h-[calc(100vh-14rem)] w-full rounded-lg" /> },
);

export function MapWrapper({ pins }: { pins: MapPin[] }) {
  return <PartnerMap pins={pins} />;
}
