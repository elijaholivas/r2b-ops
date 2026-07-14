import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Plays a short pleasant chime using the Web Audio API.
 * No external audio file needed — synthesized in-browser.
 */
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playNote = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Pleasant two-note chime: E5 then G#5
    const now = ctx.currentTime;
    playNote(659.25, now, 0.6, 0.3);         // E5
    playNote(830.61, now + 0.15, 0.8, 0.25); // G#5

    setTimeout(() => ctx.close(), 1500);
  } catch (_) {
    // Audio not available (e.g. autoplay policy) — silent fail
  }
}

/**
 * useEnrollmentChime — polls every 30 seconds for new enrollments.
 * When new enrollments are detected, plays a chime and shows a toast.
 * `since` is stored in React state so each poll uses the latest watermark.
 */
export function useEnrollmentChime(enabled: boolean) {
  // React state so query input updates when watermark advances
  const [since, setSince] = useState<number>(() => Date.now());
  const seenIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);

  const { data } = trpc.enrollments.recent.useQuery(
    { since },
    {
      enabled,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      staleTime: 0,
    }
  );

  const handleData = useCallback((
    enrollments: Array<{
      id: number;
      createdAt: number;
      classId: number;
      classTitle: string;
      studentName: string;
    }>
  ) => {
    // On the very first fetch, just seed seenIds and watermark — don't chime
    if (isFirstFetchRef.current) {
      isFirstFetchRef.current = false;
      enrollments.forEach((e) => seenIdsRef.current.add(e.id));
      if (enrollments.length > 0) {
        const maxTs = Math.max(...enrollments.map((e) => e.createdAt));
        setSince(maxTs + 1);
      }
      return;
    }

    const fresh = enrollments.filter((e) => !seenIdsRef.current.has(e.id));
    if (fresh.length === 0) return;

    fresh.forEach((e) => seenIdsRef.current.add(e.id));

    // Advance the watermark in state so next poll queries from here
    const maxTs = Math.max(...fresh.map((e) => e.createdAt));
    setSince(maxTs + 1);

    // Play chime once regardless of how many new enrollments
    playChime();

    // Show a toast for each (max 3 to avoid flooding)
    fresh.slice(0, 3).forEach((e) => {
      toast.success(`New enrollment: ${e.studentName}`, {
        description: e.classTitle,
        duration: 6000,
        icon: "🎯",
      });
    });

    if (fresh.length > 3) {
      toast.info(`+${fresh.length - 3} more new enrollments`, { duration: 4000 });
    }
  }, []);

  useEffect(() => {
    if (data) handleData(data);
  }, [data, handleData]);
}
