import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Pause, Play, Plus, Square, Trash2, Check, X, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useHuntChannel, useNow } from "@/hooks/useHuntChannel";
import { OverlayPanel } from "@/components/overlay/OverlayPanel";
import {
  computeStats,
  money,
  moneySigned,
  multi,
  multiplierOf,
  num,
  runTime,
  OVERLAY_POSITIONS,
  type Bonus,
  type Hunt,
  type Slot,
  type OverlayPosition,
} from "@/lib/bonus-hunt";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHANNEL = "mkn";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MKN Bonus Hunt — Control Room" },
      {
        name: "description",
        content:
          "Track bonus hunts live: add bonuses, watch stats update instantly and feed the OBS overlay.",
      },
      { property: "og:title", content: "MKN Bonus Hunt — Control Room" },
      {
        property: "og:description",
        content: "Track bonus hunts live and feed the OBS broadcast overlay.",
      },
    ],
  }),
  component: AdminPage,
});

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-panel/80 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] ${className}`}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="stat-label text-[12px] text-foreground">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  );
}

function AdminPage() {
  const { hunt, bonuses, refresh } = useHuntChannel(CHANNEL);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [history, setHistory] = useState<Hunt[]>([]);
  const now = useNow(hunt?.status === "live");
  const stats = computeStats(bonuses);

  const loadSlots = useCallback(async () => {
    const { data } = await supabase.from("slots").select("*").order("name");
    setSlots((data ?? []) as unknown as Slot[]);
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("hunts")
      .select("*, bonuses(win, buyin)")
      .eq("channel", CHANNEL)
      .order("created_at", { ascending: false })
      .limit(12);
    setHistory((data ?? []) as unknown as Hunt[]);
  }, []);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory, hunt?.id, hunt?.status]);

  const overlayUrl =
    typeof window !== "undefined" ? `${window.location.origin}/bonus-hunt/${CHANNEL}` : "";

  /* ---------------- hunt controls ---------------- */

  const createHunt = async () => {
    const { error } = await supabase
      .from("hunts")
      .insert({ channel: CHANNEL, name: "Bonus Hunt", status: "draft", target_bonuses: 50 });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("New hunt created");
    await refresh();
  };

  const patchHunt = async (patch: Partial<Hunt>) => {
    if (!hunt) return;
    const { error } = await supabase.from("hunts").update(patch).eq("id", hunt.id);
    if (error) toast.error(error.message);
    await refresh();
  };

  /* ---------------- add bonus ---------------- */

  const [slotId, setSlotId] = useState<string>("");
  const [buyin, setBuyin] = useState("");
  const [bet, setBet] = useState("");
  const [win, setWin] = useState("");
  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotProvider, setNewSlotProvider] = useState("");

  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;
  const previewX = useMemo(() => {
    const b = Number(bet);
    const w = Number(win);
    return b > 0 && !Number.isNaN(w) ? w / b : 0;
  }, [bet, win]);

  const onSelectSlot = (id: string) => {
    setSlotId(id);
    const s = slots.find((x) => x.id === id);
    if (s) {
      if (!bet && s.default_bet != null) setBet(String(num(s.default_bet)));
      if (!buyin && s.default_buyin != null) setBuyin(String(num(s.default_buyin)));
    }
  };

  const addBonus = async () => {
    if (!hunt) {
      toast.error("Create a hunt first");
      return;
    }
    if (!selectedSlot) {
      toast.error("Pick a slot");
      return;
    }
    const nextSeq = bonuses.length ? Math.max(...bonuses.map((b) => b.sequence)) + 1 : 1;
    const { error } = await supabase.from("bonuses").insert({
      hunt_id: hunt.id,
      slot_id: selectedSlot.id,
      slot_name: selectedSlot.name,
      sequence: nextSeq,
      buyin: Number(buyin) || 0,
      bet: Number(bet) || 0,
      win: Number(win) || 0,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setWin("");
    toast.success(`#${nextSeq} ${selectedSlot.name} added`);
  };

  const addSlot = async () => {
    if (!newSlotName.trim()) return;
    const { data, error } = await supabase
      .from("slots")
      .insert({ name: newSlotName.trim(), provider: newSlotProvider.trim() || null })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewSlotName("");
    setNewSlotProvider("");
    await loadSlots();
    if (data) setSlotId((data as unknown as Slot).id);
    toast.success("Slot added");
  };

  /* ---------------- bonus row editing ---------------- */

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ buyin: string; bet: string; win: string }>({
    buyin: "",
    bet: "",
    win: "",
  });

  const startEdit = (b: Bonus) => {
    setEditing(b.id);
    setDraft({ buyin: String(num(b.buyin)), bet: String(num(b.bet)), win: String(num(b.win)) });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("bonuses")
      .update({
        buyin: Number(draft.buyin) || 0,
        bet: Number(draft.bet) || 0,
        win: Number(draft.win) || 0,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
  };

  const removeBonus = async (id: string) => {
    const { error } = await supabase.from("bonuses").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const [targetDraft, setTargetDraft] = useState("");
  useEffect(() => {
    setTargetDraft(hunt?.target_bonuses != null ? String(hunt.target_bonuses) : "");
  }, [hunt?.id, hunt?.target_bonuses]);

  const status = hunt?.status ?? "draft";

  return (
    <main className="min-h-screen bg-background px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-800 tracking-[0.14em]">
              <span className="gold-text">MKN</span>
              <span className="mx-2 text-muted-foreground">/</span>BONUS HUNT
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Control room — everything here feeds the stream overlay live.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2">
            <span className="stat-label">Overlay link</span>
            <code className="max-w-[320px] truncate text-sm text-foreground">{overlayUrl}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(overlayUrl);
                toast.success("Overlay link copied — paste into an OBS Browser Source");
              }}
            >
              <Copy className="size-4" /> Copy
            </Button>
            <a href={`/bonus-hunt/${CHANNEL}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost">
                Open
              </Button>
            </a>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_470px]">
          <div className="space-y-6">
            {/* Hunt control */}
            <Panel
              title={hunt ? `Bonus Hunt #${String(hunt.number).padStart(3, "0")}` : "No hunt yet"}
              action={
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      status === "live" ? "live-dot bg-success" : "bg-muted-foreground"
                    }`}
                  />
                  <span className="stat-label text-foreground">{status.toUpperCase()}</span>
                </div>
              }
            >
              {!hunt ? (
                <Button onClick={createHunt}>
                  <Plus className="size-4" /> Create first hunt
                </Button>
              ) : (
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-36">
                    <Label className="stat-label">Target bonuses</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      value={targetDraft}
                      onChange={(e) => setTargetDraft(e.target.value)}
                      onBlur={() =>
                        void patchHunt({
                          target_bonuses: targetDraft ? Number(targetDraft) : null,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  </div>
                  <div>
                    <Label className="stat-label">Run time</Label>
                    <div className="stat-value mt-2 text-2xl">
                      {runTime(hunt.started_at, hunt.ended_at, now)}
                    </div>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {status !== "live" ? (
                      <Button
                        onClick={() =>
                          void patchHunt({
                            status: "live",
                            ended_at: null,
                            started_at: hunt.started_at ?? new Date().toISOString(),
                          })
                        }
                      >
                        <Play className="size-4" /> {status === "paused" ? "Resume" : "Start hunt"}
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => void patchHunt({ status: "paused" })}>
                        <Pause className="size-4" /> Pause
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void patchHunt({ status: "ended", ended_at: new Date().toISOString() })
                      }
                    >
                      <Square className="size-4" /> End hunt
                    </Button>
                    <Button variant="outline" onClick={createHunt}>
                      <Plus className="size-4" /> New hunt
                    </Button>
                  </div>
                </div>
              )}
            </Panel>

            {/* Stats strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {[
                { l: "Bonuses", v: `${stats.count}${hunt?.target_bonuses ? ` / ${hunt.target_bonuses}` : ""}` },
                { l: "Bet", v: stats.betLabel },
                { l: "Best win", v: stats.count ? money(stats.bestWin) : "—" },
                { l: "Best X", v: stats.count ? multi(stats.bestX) : "—" },
                { l: "Avg win", v: stats.count ? money(stats.avgWin) : "—" },
                {
                  l: "Profit / Loss",
                  v: stats.count ? moneySigned(stats.profitLoss) : "—",
                  tone: stats.profitLoss >= 0 ? "text-success" : "text-destructive",
                },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-border bg-panel px-4 py-3">
                  <div className="stat-label">{s.l}</div>
                  <div className={`stat-value mt-1 text-xl ${"tone" in s ? s.tone : ""}`}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Add bonus */}
            <Panel title="Add bonus">
              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] md:items-end">
                <div>
                  <Label className="stat-label">Slot</Label>
                  <Select value={slotId} onValueChange={onSelectSlot}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {slots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.provider ? ` — ${s.provider}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="stat-label">Buy-in</Label>
                  <Input
                    className="mt-2"
                    inputMode="decimal"
                    value={buyin}
                    onChange={(e) => setBuyin(e.target.value)}
                    placeholder="100.00"
                  />
                </div>
                <div>
                  <Label className="stat-label">Bet</Label>
                  <Input
                    className="mt-2"
                    inputMode="decimal"
                    value={bet}
                    onChange={(e) => setBet(e.target.value)}
                    placeholder="2.00"
                  />
                </div>
                <div>
                  <Label className="stat-label">Win</Label>
                  <Input
                    className="mt-2"
                    inputMode="decimal"
                    value={win}
                    onChange={(e) => setWin(e.target.value)}
                    placeholder="230.00"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addBonus();
                    }}
                  />
                </div>
                <Button className="h-10" onClick={addBonus}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="stat-label">Multiplier</span>
                <span className="stat-value gold-text text-xl">
                  {previewX > 0 ? multi(previewX) : "—"}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-border pt-5">
                <div>
                  <Label className="stat-label">New slot name</Label>
                  <Input
                    className="mt-2 w-56"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    placeholder="Le Bandit"
                  />
                </div>
                <div>
                  <Label className="stat-label">Provider</Label>
                  <Input
                    className="mt-2 w-48"
                    value={newSlotProvider}
                    onChange={(e) => setNewSlotProvider(e.target.value)}
                    placeholder="Hacksaw Gaming"
                  />
                </div>
                <Button variant="secondary" onClick={addSlot}>
                  Save slot
                </Button>
              </div>
            </Panel>

            {/* Bonus list */}
            <Panel title={`Bonus list — ${bonuses.length}`}>
              {bonuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bonuses yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        {["#", "Slot", "Buy-in", "Bet", "Win", "X", ""].map((h) => (
                          <th key={h} className="stat-label pb-3 font-600">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...bonuses].reverse().map((b) => {
                        const isEdit = editing === b.id;
                        return (
                          <tr key={b.id} className="border-t border-border">
                            <td className="py-2.5 text-muted-foreground">{b.sequence}</td>
                            <td className="py-2.5 pr-4 font-600">{b.slot_name}</td>
                            {(["buyin", "bet", "win"] as const).map((f) => (
                              <td key={f} className="py-2 pr-3">
                                {isEdit ? (
                                  <Input
                                    className="h-8 w-24"
                                    value={draft[f]}
                                    onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                                  />
                                ) : (
                                  <span className="stat-value text-base">{money(num(b[f]))}</span>
                                )}
                              </td>
                            ))}
                            <td className="stat-value gold-text py-2.5 text-base">
                              {multi(multiplierOf(b))}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end gap-1">
                                {isEdit ? (
                                  <>
                                    <Button size="icon" variant="ghost" onClick={() => void saveEdit(b.id)}>
                                      <Check className="size-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                                      <X className="size-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="icon" variant="ghost" onClick={() => startEdit(b)}>
                                      <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => void removeBonus(b.id)}
                                    >
                                      <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* History */}
            <Panel title="History">
              <ul className="divide-y divide-border">
                {history.map((h) => {
                  const rows = ((h as unknown as { bonuses?: { win: number; buyin: number }[] })
                    .bonuses ?? []) as { win: number; buyin: number }[];
                  const pl = rows.reduce((a, r) => a + num(r.win) - num(r.buyin), 0);
                  return (
                    <li key={h.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-600">
                          Bonus Hunt #{String(h.number).padStart(3, "0")}
                          {h.id === hunt?.id ? (
                            <span className="stat-label ml-3 text-gold">current</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          · {rows.length} bonuses · {h.status}
                        </div>
                      </div>
                      <div
                        className={`stat-value text-lg ${pl >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {rows.length ? moneySigned(pl) : "—"}
                      </div>
                    </li>
                  );
                })}
                {history.length === 0 ? (
                  <li className="py-3 text-sm text-muted-foreground">No hunts yet.</li>
                ) : null}
              </ul>
            </Panel>
          </div>

          {/* Right column: overlay preview + settings */}
          <div className="space-y-6">
            <Panel title="Overlay settings">
              <div className="space-y-5">
                <div>
                  <Label className="stat-label">Panel position</Label>
                  <Select
                    value={hunt?.overlay_position ?? "right-center"}
                    onValueChange={(v) =>
                      void patchHunt({ overlay_position: v as OverlayPosition })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERLAY_POSITIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="stat-label">Show last bonus</Label>
                  <Switch
                    checked={hunt?.show_last_bonus ?? true}
                    onCheckedChange={(v) => void patchHunt({ show_last_bonus: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="stat-label">Big win alerts</Label>
                  <Switch
                    checked={hunt?.big_win_alerts ?? true}
                    onCheckedChange={(v) => void patchHunt({ big_win_alerts: v })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  In OBS add a Browser Source with the overlay link, 1920 × 1080, 60 FPS. The
                  background stays transparent.
                </p>
              </div>
            </Panel>

            <Panel title="Live preview">
              <div className="relative h-[620px] overflow-hidden rounded-xl border border-border bg-[repeating-conic-gradient(oklch(0.24_0.006_264)_0%_25%,oklch(0.2_0.006_264)_0%_50%)] bg-[length:28px_28px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="origin-center scale-[0.88]">
                    <OverlayPanel hunt={hunt} bonuses={bonuses} />
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
