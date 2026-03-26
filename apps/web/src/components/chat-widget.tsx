"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: number;
  durationMs?: number;
}

const EXAMPLE_QUESTIONS = [
  "이번 달 주문 현황",
  "최근 수신 메시지",
  "이번 달 이익률",
  "전월 대비 매출 비교",
  "영업담당자 누구야?",
  "연결된 기기 상태",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: "안녕하세요! NotiFlow AI 어시스턴트입니다.\n주문, 메시지, 거래처, 매출 등에 대해 자유롭게 질문해주세요." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Draggable state
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from default (bottom-right)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; dragging: boolean }>({
    startX: 0, startY: 0, startPosX: 0, startPosY: 0, dragging: false,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const didDrag = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y, dragging: true };
    didDrag.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    setPos({ x: dragRef.current.startPosX + dx, y: dragRef.current.startPosY + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleClick = useCallback(() => {
    if (!didDrag.current) setIsOpen(prev => !prev);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleSend = useCallback(async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const res = await fetch("/api/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error);
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        intent: data.intent,
        confidence: data.confidence,
        durationMs: data.durationMs,
      }]);
    } catch (err) {
      const msg = err instanceof Error
        ? err.name === "AbortError"
          ? "AI 응답 시간이 초과되었습니다. 다시 시도해주세요."
          : err.message === "Failed to fetch"
            ? "서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
            : err.message
        : "응답 처리 중 오류가 발생했습니다.";
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: msg }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  return (
    <>
      {/* Floating Draggable Button */}
      <button
        ref={btnRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "fixed z-[9999] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors duration-150 print:hidden select-none touch-none",
          isOpen
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700 shadow-violet-500/30",
        )}
        style={{
          bottom: `${24 - pos.y}px`,
          right: `${24 - pos.x}px`,
          cursor: dragRef.current.dragging ? "grabbing" : "grab",
        }}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed z-[9999] w-[380px] max-h-[560px] flex flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden print:hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{
            bottom: `${80 - pos.y}px`,
            right: `${24 - pos.x}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">NotiFlow AI</p>
              <p className="text-[10px] text-muted-foreground">자연어로 주문·메시지·매출을 조회하세요</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-[380px]">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-br-md"
                    : "bg-muted rounded-bl-md",
                )}>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  {msg.intent && msg.intent !== "unknown" && (
                    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-foreground/10 text-[10px] opacity-60">
                      <span>{msg.intent}</span>
                      {msg.confidence != null && <span>신뢰도 {Math.round(msg.confidence * 100)}%</span>}
                      {msg.durationMs != null && <span>{(msg.durationMs / 1000).toFixed(1)}초</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                </div>
              </div>
            )}
          </div>

          {/* Example Questions */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-4 pb-2">
              <p className="text-[10px] text-muted-foreground mb-1.5">예시 질문</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="질문을 입력하세요..."
                disabled={isLoading}
                className="flex-1 rounded-full border bg-muted/30 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="h-9 w-9 rounded-full shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
