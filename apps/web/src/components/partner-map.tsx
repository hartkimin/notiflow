"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapMarker } from "@/lib/queries/map-data";

// Fix leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  hospital: { label: "거래처", color: "#3b82f6", emoji: "🏥" },
  supplier: { label: "공급사", color: "#10b981", emoji: "🏭" },
  company: { label: "자사", color: "#ef4444", emoji: "🏢" },
};

function createIcon(type: string) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.hospital;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background: ${config.color};
      color: white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${config.emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// Geocode address using Nominatim
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=kr&limit=1`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function FitBounds({ markers }: { markers: { lat: number; lng: number }[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (markers.length > 0 && !fitted.current) {
      fitted.current = true;
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [markers, map]);

  return null;
}

interface PartnerMapProps {
  markers: MapMarker[];
}

export function PartnerMap({ markers: initialMarkers }: PartnerMapProps) {
  const [geocodedMarkers, setGeocodedMarkers] = useState<(MapMarker & { lat: number; lng: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function resolveAll() {
      const results: (MapMarker & { lat: number; lng: number })[] = [];
      const failedAddrs: string[] = [];

      for (const marker of initialMarkers) {
        if (cancelled) break;
        if (marker.lat && marker.lng) {
          results.push({ ...marker, lat: marker.lat, lng: marker.lng });
          continue;
        }
        const coords = await geocode(marker.address);
        if (coords) {
          results.push({ ...marker, ...coords });
        } else {
          failedAddrs.push(`${marker.name} (${marker.address})`);
        }
        // Rate limit: 1 req/sec for Nominatim
        await new Promise((r) => setTimeout(r, 1100));
      }

      if (!cancelled) {
        setGeocodedMarkers(results);
        setFailed(failedAddrs);
        setLoading(false);
      }
    }

    resolveAll();
    return () => { cancelled = true; };
  }, [initialMarkers]);

  // Default center: Seoul
  const defaultCenter: [number, number] = [37.5665, 126.978];

  return (
    <div className="space-y-2">
      {loading && (
        <div className="text-sm text-muted-foreground text-center py-2">
          주소를 좌표로 변환 중... ({geocodedMarkers.length}/{initialMarkers.length})
        </div>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ height: "calc(100vh - 14rem)" }}>
        <MapContainer
          center={defaultCenter}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geocodedMarkers.map((marker) => {
            const config = TYPE_CONFIG[marker.type] || TYPE_CONFIG.hospital;
            return (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={createIcon(marker.type)}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-bold">{config.emoji} {marker.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{config.label}</div>
                    <div className="text-xs mt-1">{marker.address}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          <FitBounds markers={geocodedMarkers} />
        </MapContainer>
      </div>

      {/* Legend + stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const count = geocodedMarkers.filter((m) => m.type === key).length;
          return (
            <span key={key} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: cfg.color }} />
              {cfg.label} {count}
            </span>
          );
        })}
        {failed.length > 0 && (
          <span className="text-orange-500">주소 변환 실패 {failed.length}건</span>
        )}
      </div>

      {failed.length > 0 && (
        <details className="text-xs">
          <summary className="text-orange-500 cursor-pointer">주소 변환 실패 목록 ({failed.length}건)</summary>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {failed.map((f, i) => <li key={i}>• {f}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
