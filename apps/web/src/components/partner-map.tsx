"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

// Memoized icon cache (only 3 icons needed)
const ICON_CACHE: Record<string, L.DivIcon> = {};
function getIcon(type: string) {
  if (ICON_CACHE[type]) return ICON_CACHE[type];
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.hospital;
  ICON_CACHE[type] = L.divIcon({
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
  return ICON_CACHE[type];
}

function FitBounds({ markers }: { markers: { lat: number; lng: number }[] }) {
  const map = useMap();
  const prevCount = useRef(0);
  useEffect(() => {
    if (markers.length > 0 && markers.length !== prevCount.current) {
      prevCount.current = markers.length;
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [markers, map]);
  return null;
}

export interface MapPin {
  id: string;
  type: "hospital" | "supplier" | "company";
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
}

interface PartnerMapProps {
  pins: MapPin[];
}

export function PartnerMap({ pins }: PartnerMapProps) {
  const defaultCenter: [number, number] = [37.5665, 126.978];
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(["hospital", "supplier", "company"]));

  const filteredPins = useMemo(() => {
    return pins.filter((pin) => {
      if (!activeTypes.has(pin.type)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return pin.name.toLowerCase().includes(q) || pin.address.toLowerCase().includes(q);
      }
      return true;
    });
  }, [pins, searchQuery, activeTypes]);

  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {/* Toolbar: search + type filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="업체명 또는 주소 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const count = pins.filter((p) => p.type === key).length;
            if (count === 0) return null;
            const active = activeTypes.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleType(key)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${
                  active
                    ? "border-current bg-white shadow-sm"
                    : "border-transparent text-muted-foreground opacity-50"
                }`}
                style={active ? { color: cfg.color } : undefined}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: active ? cfg.color : "#ccc" }} />
                {cfg.label}
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-0.5">{count}</Badge>
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredPins.length === pins.length ? `전체 ${pins.length}개` : `${filteredPins.length}/${pins.length}개`}
        </span>
      </div>

      {/* Map or empty state */}
      {pins.length === 0 ? (
        <div className="rounded-lg border flex flex-col items-center justify-center bg-muted/20" style={{ height: "calc(100vh - 14rem)" }}>
          <MapPin className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">지도에 표시할 업체가 없습니다</p>
          <p className="text-xs text-muted-foreground/60 mt-1">거래처 또는 공급사에 주소를 입력하면 자동으로 지도에 표시됩니다</p>
        </div>
      ) : (
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
            {filteredPins.map((pin) => {
              const config = TYPE_CONFIG[pin.type] || TYPE_CONFIG.hospital;
              const detailPath = pin.type === "hospital" ? "/hospitals" : pin.type === "supplier" ? "/suppliers" : null;
              return (
                <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={getIcon(pin.type)}>
                  <Popup>
                    <div className="text-sm min-w-[200px] space-y-1.5">
                      <div className="font-bold text-base">{config.emoji} {pin.name}</div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: config.color }} />
                        <span className="text-xs font-medium" style={{ color: config.color }}>{config.label}</span>
                      </div>
                      {pin.address && (
                        <div className="text-xs text-gray-600">{pin.address}</div>
                      )}
                      {pin.phone && (
                        <div className="text-xs">
                          <a href={`tel:${pin.phone}`} className="text-blue-600 hover:underline">{pin.phone}</a>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1 border-t">
                        {pin.address && (
                          <a
                            href={`https://map.naver.com/v5/search/${encodeURIComponent(pin.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            <ExternalLink className="h-3 w-3" /> 네이버 지도
                          </a>
                        )}
                        {detailPath && (
                          <a
                            href={detailPath}
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            상세 보기 →
                          </a>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            <FitBounds markers={filteredPins} />
          </MapContainer>
        </div>
      )}
    </div>
  );
}
