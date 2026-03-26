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

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; svg: string }> = {
  hospital: {
    label: "거래처",
    color: "#3b82f6",
    bg: "linear-gradient(135deg, #3b82f6, #2563eb)",
    svg: `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" fill="white"/>`,
  },
  supplier: {
    label: "공급사",
    color: "#10b981",
    bg: "linear-gradient(135deg, #10b981, #059669)",
    svg: `<path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>`,
  },
  company: {
    label: "자사(본사)",
    color: "#f59e0b",
    bg: "linear-gradient(135deg, #f59e0b, #d97706)",
    svg: `<path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" fill="white"/>`,
  },
};

// Icon cache
const ICON_CACHE: Record<string, L.DivIcon> = {};
function getIcon(type: string) {
  if (ICON_CACHE[type]) return ICON_CACHE[type];
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.hospital;
  const isCompany = type === "company";
  const size = isCompany ? 44 : 34;
  const svgSize = isCompany ? 22 : 16;

  ICON_CACHE[type] = L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background: ${config.bg};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: ${isCompany ? "3px" : "2px"} solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,${isCompany ? "0.4" : "0.25"});
      ${isCompany ? "animation: companyPulse 2s ease-in-out infinite;" : ""}
    "><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${svgSize}" height="${svgSize}" style="transform: rotate(45deg);">${config.svg}</svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
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

  // Sort so company renders last (on top)
  const sortedPins = useMemo(() => {
    return [...filteredPins].sort((a, b) => {
      if (a.type === "company") return 1;
      if (b.type === "company") return -1;
      return 0;
    });
  }, [filteredPins]);

  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {/* Inject company pulse animation */}
      <style>{`
        @keyframes companyPulse {
          0%, 100% { box-shadow: 0 3px 10px rgba(245,158,11,0.4); }
          50% { box-shadow: 0 3px 20px rgba(245,158,11,0.7), 0 0 0 8px rgba(245,158,11,0.1); }
        }
        .leaflet-container { font-family: inherit; }
        .custom-marker { background: none !important; border: none !important; }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                  active
                    ? "bg-white shadow-sm border-current"
                    : "border-transparent text-muted-foreground opacity-50 hover:opacity-75"
                }`}
                style={active ? { color: cfg.color, borderColor: cfg.color } : undefined}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: active ? cfg.color : "#ccc" }}
                />
                {cfg.label}
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-0.5">{count}</Badge>
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredPins.length === pins.length ? `${pins.length}개` : `${filteredPins.length}/${pins.length}개`}
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
        <div className="rounded-lg border overflow-hidden" style={{ height: "calc(100vh - 14rem)" }}>
          <MapContainer
            center={defaultCenter}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {sortedPins.map((pin) => {
              const config = TYPE_CONFIG[pin.type] || TYPE_CONFIG.hospital;
              const isCompany = pin.type === "company";
              const detailPath = pin.type === "hospital" ? "/hospitals" : pin.type === "supplier" ? "/suppliers" : null;
              return (
                <Marker
                  key={pin.id}
                  position={[pin.lat, pin.lng]}
                  icon={getIcon(pin.type)}
                  zIndexOffset={isCompany ? 1000 : 0}
                >
                  <Popup>
                    <div className="text-sm min-w-[220px] space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                          style={{ background: config.color }}
                          dangerouslySetInnerHTML={{
                            __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">${config.svg}</svg>`,
                          }}
                        />
                        <div>
                          <div className="font-bold text-sm leading-tight">{pin.name}</div>
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: config.color }}
                          >
                            {config.label}
                          </span>
                        </div>
                      </div>
                      {pin.address && (
                        <div className="text-xs text-gray-600 leading-snug">{pin.address}</div>
                      )}
                      {pin.phone && (
                        <div className="text-xs">
                          <a href={`tel:${pin.phone}`} className="text-blue-600 hover:underline">{pin.phone}</a>
                        </div>
                      )}
                      <div className="flex gap-3 pt-1.5 border-t">
                        {pin.address && (
                          <a
                            href={`https://map.naver.com/v5/search/${encodeURIComponent(pin.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            <ExternalLink className="h-3 w-3" /> 네이버 지도
                          </a>
                        )}
                        {detailPath && (
                          <a href={detailPath} className="text-[10px] text-blue-600 hover:underline font-medium">
                            상세 보기 &rarr;
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
