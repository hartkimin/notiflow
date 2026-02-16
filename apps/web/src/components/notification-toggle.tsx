"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationToggle() {
  const { supported, enabled, permission, toggle } = useNotifications();

  if (!supported) return null;

  const denied = permission === "denied";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={toggle}
          disabled={denied}
        >
          {enabled ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="sr-only">알림 {enabled ? "끄기" : "켜기"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {denied
          ? "브라우저 설정에서 알림이 차단되었습니다"
          : enabled
            ? "브라우저 알림 끄기"
            : "브라우저 알림 켜기"}
      </TooltipContent>
    </Tooltip>
  );
}
