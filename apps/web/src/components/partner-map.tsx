"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function FitBounds({ markers }: { markers: { lat: number; lng: number }[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (markers.length > 0 && !fitted.current) {
      fitted.current = true;
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [markers, map]);
  return null;
}

export interface MapPin {
  id: string;
  type: "hospital" | "supplier" | "company";
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PartnerMapProps {
  pins: MapPin[];
}

export function PartnerMap({ pins }: PartnerMapProps) {
  const defaultCenter: [number, number] = [37.5665, 126.978];

  return (
    <div className="space-y-2">
      <div className="rounded-lg border overflow-hidden relative z-0" style={{ height: "calc(100vh - 14rem)" }}>
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
          {pins.map((pin) => {
            const config = TYPE_CONFIG[pin.type] || TYPE_CONFIG.hospital;
            return (
              <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={createIcon(pin.type)}>
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-bold">{config.emoji} {pin.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{config.label}</div>
                    <div className="text-xs mt-1">{pin.address}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          <FitBounds markers={pins} />
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const count = pins.filter((p) => p.type === key).length;
          if (count === 0) return null;
          return (
            <span key={key} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: cfg.color }} />
              {cfg.label} {count}
            </span>
          );
        })}
        <span>총 {pins.length}개</span>
      </div>
    </div>
  );
}
