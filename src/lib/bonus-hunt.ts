export type HuntStatus = "draft" | "live" | "paused" | "ended";

export type Slot = {
  id: string;
  name: string;
  provider: string | null;
  icon_url: string | null;
  default_bet: number | null;
  default_buyin: number | null;
};

export type Hunt = {
  id: string;
  number: number;
  name: string;
  channel: string;
  status: HuntStatus;
  target_bonuses: number | null;
  started_at: string | null;
  ended_at: string | null;
  show_last_bonus: boolean;
  big_win_alerts: boolean;
  overlay_position: OverlayPosition;
  created_at: string;
};

export type Bonus = {
  id: string;
  hunt_id: string;
  slot_id: string | null;
  slot_name: string;
  sequence: number;
  buyin: number;
  bet: number;
  win: number;
  created_at: string;
};

export type OverlayPosition =
  | "top-right"
  | "right-center"
  | "top-left"
  | "left-center"
  | "bottom-center";

export const OVERLAY_POSITIONS: { value: OverlayPosition; label: string }[] = [
  { value: "top-right", label: "Top right" },
  { value: "right-center", label: "Right center" },
  { value: "top-left", label: "Top left" },
  { value: "left-center", label: "Left center" },
  { value: "bottom-center", label: "Bottom center" },
];

export const positionClass = (p: OverlayPosition) => {
  switch (p) {
    case "top-right":
      return "top-[60px] right-[60px]";
    case "top-left":
      return "top-[60px] left-[60px]";
    case "left-center":
      return "top-1/2 left-[60px] -translate-y-1/2";
    case "bottom-center":
      return "bottom-[60px] left-1/2 -translate-x-1/2";
    case "right-center":
    default:
      return "top-1/2 right-[60px] -translate-y-1/2";
  }
};

export const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export const money = (v: number) =>
  (v < 0 ? "-$" : "$") +
  Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const moneySigned = (v: number) =>
  (v >= 0 ? "+" : "-") +
  "$" +
  Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const multi = (v: number) => {
  const rounded = Math.round(v * 10) / 10;
  const decimals = Number.isInteger(rounded) ? 0 : 1;
  return (
    rounded.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + "x"
  );
};

export const multiplierOf = (b: Pick<Bonus, "bet" | "win">) => {
  const bet = num(b.bet);
  return bet > 0 ? num(b.win) / bet : 0;
};

export const runTime = (fromISO: string | null, toISO: string | null, nowMs: number) => {
  if (!fromISO) return "—";
  const end = toISO ? new Date(toISO).getTime() : nowMs;
  const secs = Math.max(0, Math.floor((end - new Date(fromISO).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
};

export type HuntStats = ReturnType<typeof computeStats>;

export function computeStats(bonuses: Bonus[]) {
  const count = bonuses.length;
  const wins = bonuses.map((b) => num(b.win));
  const bets = bonuses.map((b) => num(b.bet));
  const buyins = bonuses.map((b) => num(b.buyin));
  const multipliers = bonuses.map(multiplierOf);

  const totalWin = wins.reduce((a, b) => a + b, 0);
  const totalBuyin = buyins.reduce((a, b) => a + b, 0);
  const bestWin = count ? Math.max(...wins) : 0;
  const bestWinBonus = bonuses.find((b) => num(b.win) === bestWin) ?? null;
  const bestX = count ? Math.max(...multipliers) : 0;

  const uniqueBets = Array.from(new Set(bets)).sort((a, b) => a - b);
  const betLabel = !count
    ? "—"
    : uniqueBets.length === 1
      ? money(uniqueBets[0]!)
      : `${money(uniqueBets[0]!)} – ${money(uniqueBets[uniqueBets.length - 1]!)}`;

  return {
    count,
    totalWin,
    totalBuyin,
    profitLoss: totalWin - totalBuyin,
    bestWin,
    bestWinX: bestWinBonus ? multiplierOf(bestWinBonus) : 0,
    bestWinSlot: bestWinBonus?.slot_name ?? null,
    bestX,
    avgWin: count ? totalWin / count : 0,
    avgX: count ? multipliers.reduce((a, b) => a + b, 0) / count : 0,
    betLabel,
  };
}

export function winTier(x: number): { label: string; tone: "big" | "huge" | "mega" } | null {
  if (x >= 1000) return { label: "MEGA WIN", tone: "mega" };
  if (x >= 500) return { label: "HUGE WIN", tone: "huge" };
  if (x >= 100) return { label: "BIG WIN", tone: "big" };
  return null;
}
