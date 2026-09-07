import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bonus, Hunt } from "@/lib/bonus-hunt";

/**
 * Loads the current hunt for a channel (live/paused first, otherwise the most
 * recent one) plus its bonuses, and keeps both in sync in realtime.
 */
export function useHuntChannel(channel: string) {
  const [hunt, setHunt] = useState<Hunt | null>(null);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const huntIdRef = useRef<string | null>(null);

  const loadBonuses = useCallback(async (huntId: string) => {
    const { data } = await supabase
      .from("bonuses")
      .select("*")
      .eq("hunt_id", huntId)
      .order("sequence", { ascending: true });
    setBonuses((data ?? []) as unknown as Bonus[]);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("hunts")
      .select("*")
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .limit(20);

    const list = (data ?? []) as unknown as Hunt[];
    const active = list.find((h) => h.status === "live" || h.status === "paused");
    const current = active ?? list[0] ?? null;
    setHunt(current);
    huntIdRef.current = current?.id ?? null;
    if (current) await loadBonuses(current.id);
    else setBonuses([]);
    setLoading(false);
  }, [channel, loadBonuses]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel(`hunt-${channel}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hunts" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bonuses" }, () => {
        if (huntIdRef.current) void loadBonuses(huntIdRef.current);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channel, refresh, loadBonuses]);

  return { hunt, bonuses, loading, refresh, setBonuses };
}

export function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
