"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  StatusStep,
  MessageLocalData,
  MessageLocalStateMap,
  StatusChangeItem,
  MessageComment,
} from "@/lib/types";

const STEPS_KEY = "notiflow-status-steps";
const STATES_KEY = "notiflow-message-states";

const DEFAULT_STEPS: StatusStep[] = [
  { id: "step-접수", name: "접수", color: "#3B82F6", orderIndex: 0 },
  { id: "step-확인중", name: "확인중", color: "#F59E0B", orderIndex: 1 },
  { id: "step-처리중", name: "처리중", color: "#8B5CF6", orderIndex: 2 },
  { id: "step-완료", name: "완료", color: "#10B981", orderIndex: 3 },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLocal(): MessageLocalData {
  return {
    statusId: null,
    statusHistory: [],
    isPinned: false,
    snoozeAt: null,
    comments: [],
    editedContent: null,
  };
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useMessageLocalState() {
  const [steps, setSteps] = useState<StatusStep[]>(DEFAULT_STEPS);
  const [states, setStates] = useState<MessageLocalStateMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSteps(readJSON(STEPS_KEY, DEFAULT_STEPS));
    setStates(readJSON(STATES_KEY, {}));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeJSON(STEPS_KEY, steps);
  }, [steps, hydrated]);

  useEffect(() => {
    if (hydrated) writeJSON(STATES_KEY, states);
  }, [states, hydrated]);

  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.orderIndex - b.orderIndex),
    [steps],
  );

  const getState = useCallback(
    (msgId: string): MessageLocalData => states[msgId] ?? emptyLocal(),
    [states],
  );

  const updateState = useCallback(
    (msgId: string, updater: (prev: MessageLocalData) => MessageLocalData) => {
      setStates((prev) => ({
        ...prev,
        [msgId]: updater(prev[msgId] ?? emptyLocal()),
      }));
    },
    [],
  );

  const changeStatus = useCallback(
    (msgId: string, newStatusId: string) => {
      updateState(msgId, (prev) => {
        const fromStep = steps.find((s) => s.id === prev.statusId);
        const toStep = steps.find((s) => s.id === newStatusId);
        const change: StatusChangeItem = {
          id: generateId(),
          fromStatusId: prev.statusId,
          fromStatusName: fromStep?.name ?? null,
          toStatusId: newStatusId,
          toStatusName: toStep?.name ?? newStatusId,
          changedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          statusId: newStatusId,
          statusHistory: [change, ...prev.statusHistory],
        };
      });
    },
    [updateState, steps],
  );

  const clearStatus = useCallback(
    (msgId: string) => {
      updateState(msgId, (prev) => ({ ...prev, statusId: null }));
    },
    [updateState],
  );

  const togglePin = useCallback(
    (msgId: string) => {
      updateState(msgId, (prev) => ({ ...prev, isPinned: !prev.isPinned }));
    },
    [updateState],
  );

  const setSnooze = useCallback(
    (msgId: string, snoozeAt: string | null) => {
      updateState(msgId, (prev) => ({ ...prev, snoozeAt }));
    },
    [updateState],
  );

  const addComment = useCallback(
    (msgId: string, text: string) => {
      const comment: MessageComment = {
        id: generateId(),
        text,
        createdAt: new Date().toISOString(),
      };
      updateState(msgId, (prev) => ({
        ...prev,
        comments: [comment, ...prev.comments],
      }));
    },
    [updateState],
  );

  const deleteComment = useCallback(
    (msgId: string, commentId: string) => {
      updateState(msgId, (prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== commentId),
      }));
    },
    [updateState],
  );

  const setEditedContent = useCallback(
    (msgId: string, content: string | null) => {
      updateState(msgId, (prev) => ({ ...prev, editedContent: content }));
    },
    [updateState],
  );

  const updateSteps = useCallback((newSteps: StatusStep[]) => {
    setSteps(newSteps);
  }, []);

  return {
    hydrated,
    steps: sortedSteps,
    getState,
    changeStatus,
    clearStatus,
    togglePin,
    setSnooze,
    addComment,
    deleteComment,
    setEditedContent,
    updateSteps,
  };
}

export type MessageLocalStateHook = ReturnType<typeof useMessageLocalState>;
