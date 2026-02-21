"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import type { ChatRoom } from "@/lib/types";

interface NotificationDashboardProps {
  initialRooms: ChatRoom[];
  availableApps: { source: string; app_name: string }[];
  initialQuery: string;
  initialSource: string;
}

export function NotificationDashboard({
  initialRooms,
  availableApps,
  initialQuery,
  initialSource,
}: NotificationDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [selectedSource, setSelectedSource] = useState(initialSource);
  const [isSearchOpen, setIsSearchOpen] = useState(!!initialQuery);

  const navigate = useCallback(
    (q: string, source: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (source) params.set("source", source);
      const qs = params.toString();
      startTransition(() => {
        router.push(`/notifications${qs ? `?${qs}` : ""}`);
      });
    },
    [router]
  );

  // Debounced search
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => navigate(value, selectedSource), 300);
    setDebounceTimer(timer);
  };

  const handleSourceChange = (source: string) => {
    const newSource = source === selectedSource ? "" : source;
    setSelectedSource(newSource);
    navigate(query, newSource);
  };

  const clearSearch = () => {
    setQuery("");
    setIsSearchOpen(false);
    navigate("", selectedSource);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>대화방 목록</CardTitle>
            <CardDescription>
              모바일 앱에서 캡처된 알림 대화방입니다.
            </CardDescription>
          </div>
          <Button
            variant={isSearchOpen ? "secondary" : "ghost"}
            size="icon"
            onClick={() => {
              if (isSearchOpen) clearSearch();
              else setIsSearchOpen(true);
            }}
          >
            {isSearchOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Search bar */}
        {isSearchOpen && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="대화방 또는 메시지 검색"
              className="pl-9 pr-9"
              autoFocus
            />
            {query && (
              <button
                onClick={() => handleQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* App filter chips */}
        {availableApps.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              variant={selectedSource === "" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleSourceChange("")}
            >
              전체
            </Button>
            {availableApps.map((app) => (
              <Button
                key={app.source}
                variant={selectedSource === app.source ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleSourceChange(app.source)}
              >
                {app.app_name}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isPending && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            검색 중...
          </div>
        )}

        {!isPending && initialRooms.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={
              query
                ? `'${query}'에 대한 검색 결과가 없습니다.`
                : "캡처된 알림이 없습니다."
            }
            description={
              query
                ? "다른 검색어를 입력해 보세요."
                : "모바일 앱에서 알림을 동기화하면 여기에 표시됩니다."
            }
          />
        ) : (
          <div className="divide-y">
            {initialRooms.map((room) => (
              <ChatRoomRow key={`${room.source}_${room.room_id}`} room={room} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChatRoomRow({ room }: { room: ChatRoom }) {
  return (
    <div className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {room.display_title.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{room.display_title}</p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(room.last_received_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {room.last_message}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {room.match_count > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {room.match_count}건 일치
              </Badge>
            )}
            {room.unread_count > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {room.unread_count > 99 ? "99+" : room.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(epochMs: number): string {
  const now = new Date();
  const date = new Date(epochMs);

  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  const isSameYear = now.getFullYear() === date.getFullYear();

  const pad = (n: number) => n.toString().padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (isToday) return time;
  if (isSameYear)
    return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
  return `${date.getFullYear() % 100}/${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
