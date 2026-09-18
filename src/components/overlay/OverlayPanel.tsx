import { useEffect, useRef, useState } from "react";
import {
  computeStats,
  money,
  moneySigned,
  multi,
  multiplierOf,
  num,
  runTime,
  winTier,
  type Bonus,
  type Hunt,
} from "@/lib/bonus-hunt";
import { useNow } from "@/hooks/useHuntChannel";

function Stat({
  label,
  value,
  sub,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "gold" | "positive" | "negative";
  size?: "md" | "lg";
}) {
  const toneClass =
    tone === "gold"
      ? "gold-text"
      : tone === "positive"
        ? "text-success"
        : tone === "negative"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div
        className={`stat-value ${toneClass} ${size === "lg" ? "text-[42px]" : "text-[30px]"} mt-1`}
      >
        {value}
      </div>
      {sub ? <div className="stat-value mt-0.5 text-[19px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function OverlayPanel({ hunt, bonuses }: { hunt: Hunt | null; bonuses: Bonus[] }) {
  const live = hunt?.status === "live";
  const now = useNow(Boolean(live));
  const stats = computeStats(bonuses);
  const last = bonuses[bonuses.length - 1] ?? null;
  const target = hunt?.target_bonuses ?? null;
  const progress = target && target > 0 ? Math.min(100, (stats.count / target) * 100) : null;
  const empty = stats.count === 0;

  const [hero, setHero] = useState<Bonus | null>(null);
  const seen = useRef<string | null>(null);
  const firstPass = useRef(true);

  useEffect(() => {
    const id = last?.id ?? null;
    if (firstPass.current) {
      firstPass.current = false;
      seen.current = id;
      return () => {};
    }
    if (id && id !== seen.current) {
      seen.current = id;
      setHero(last);
      const t = window.setTimeout(() => setHero(null), 3000);
      return () => window.clearTimeout(t);
    }
    return () => {};
  }, [last]);

  const heroX = hero ? multiplierOf(hero) : 0;
  const tier = hero && hunt?.big_win_alerts ? winTier(heroX) : null;

  return (
    <div className="relative w-[410px]">
      {/* New bonus / big win hero */}
      {hero ? (
        <div className="animate-hero-pop absolute -top-[150px] right-0 w-[410px]">
          <div className="glass-panel rounded-2xl px-6 py-5 text-right">
            {tier ? (
              <div className="stat-label gold-text mb-1 text-[13px] tracking-[0.28em]">
                {tier.label}
              </div>
            ) : (
              <div className="stat-label mb-1">New bonus</div>
            )}
            <div className="font-display truncate text-[22px] font-700 text-foreground">
              {hero.slot_name}
            </div>
            <div className="mt-2 flex items-baseline justify-end gap-4">
              <span className="stat-value gold-text text-[38px]">{money(num(hero.win))}</span>
              <span className="stat-value text-[24px] text-muted-foreground">{multi(heroX)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="glass-panel overflow-hidden rounded-[20px]">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div className="font-display text-[20px] leading-none font-800 tracking-[0.16em]">
            <span className="gold-text">MKN</span>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-foreground">BONUS HUNT</span>
          </div>
        </div>
        <div className="gold-rule mx-7 h-px" />

        <div className="space-y-6 px-7 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  live ? "live-dot bg-success" : "bg-muted-foreground"
                }`}
              />
              <span className="stat-label text-[12px] text-foreground">
                {hunt?.status === "ended"
                  ? "ENDED"
                  : hunt?.status === "paused"
                    ? "PAUSED"
                    : live
                      ? "LIVE"
                      : "STANDBY"}
              </span>
            </div>
            <div className="text-right">
              <span className="stat-label">Run time</span>
              <span className="stat-value ml-3 text-[17px]">
                {runTime(hunt?.started_at ?? null, hunt?.ended_at ?? null, now)}
              </span>
            </div>
          </div>

          {/* Bonus count + progress */}
          <div>
            <div className="flex items-end justify-between">
              <span className="stat-label">Bonuses</span>
              <span className="stat-value text-[34px]">
                {stats.count}
                {target ? (
                  <span className="text-[22px] text-muted-foreground"> / {target}</span>
                ) : null}
              </span>
            </div>
            {progress !== null ? (
              <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-panel-2">
                <div
                  className="relative h-full rounded-full bg-gold transition-[width] duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <span className="shimmer-bar absolute inset-0 rounded-full" />
                </div>
              </div>
            ) : null}
          </div>

          {empty ? (
            <div className="py-6 text-center">
              <div className="stat-label">Waiting for first bonus…</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-y-6">
                <Stat label="Bet" value={stats.betLabel} />
                <div className="text-right">
                  <Stat label="Best X" value={multi(stats.bestX)} />
                </div>
              </div>

              <div className="h-px bg-border" />

              <Stat
                label="Best win"
                value={money(stats.bestWin)}
                sub={multi(stats.bestWinX)}
                tone="gold"
                size="lg"
              />

              <div className="grid grid-cols-2 gap-y-6">
                <Stat label="Avg win" value={money(stats.avgWin)} />
                <div className="text-right">
                  <Stat label="Avg X" value={multi(stats.avgX)} />
                </div>
              </div>

              <div className="h-px bg-border" />

              <Stat
                label="Profit / Loss"
                value={moneySigned(stats.profitLoss)}
                sub={`${money(stats.totalWin)} / ${money(stats.totalBuyin)} buy-in`}
                tone={stats.profitLoss >= 0 ? "positive" : "negative"}
                size="lg"
              />
            </>
          )}
        </div>
      </div>

      {/* Last bonus ticker */}
      {hunt?.show_last_bonus && last ? (
        <div className="glass-panel animate-bonus-in mt-3 rounded-[16px] px-6 py-4">
          <div className="stat-label mb-1.5">Last bonus</div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display truncate text-[16px] font-600">{last.slot_name}</span>
            <span className="stat-value gold-text shrink-0 text-[20px]">
              {money(num(last.win))}
            </span>
            <span className="stat-value shrink-0 text-[16px] text-muted-foreground">
              {multi(multiplierOf(last))}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
