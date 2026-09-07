import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OverlayPanel } from "@/components/overlay/OverlayPanel";
import { useHuntChannel } from "@/hooks/useHuntChannel";
import { positionClass, type OverlayPosition } from "@/lib/bonus-hunt";

export const Route = createFileRoute("/bonus-hunt/$channel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bonus Hunt Overlay" },
      { name: "description", content: "Live bonus hunt overlay for OBS Browser Source." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Bonus Hunt Overlay" },
      { property: "og:description", content: "Live bonus hunt overlay for OBS Browser Source." },
    ],
  }),
  component: OverlayRoute,
  errorComponent: () => null,
  notFoundComponent: () => null,
});

function useCanvasScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080) || 1);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

function OverlayRoute() {
  const { channel } = Route.useParams();
  const { hunt, bonuses } = useHuntChannel(channel);
  const scale = useCanvasScale();

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prev = body.getAttribute("style") ?? "";
    body.style.background = "transparent";
    body.style.margin = "0";
    body.style.overflow = "hidden";
    body.style.cursor = "none";
    html.style.background = "transparent";
    return () => {
      body.setAttribute("style", prev);
      html.style.background = "";
    };
  }, []);

  const position = (hunt?.overlay_position ?? "right-center") as OverlayPosition;

  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent select-none">
      <div
        className="absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        <div className={`absolute ${positionClass(position)}`}>
          <OverlayPanel hunt={hunt} bonuses={bonuses} />
        </div>
      </div>
    </div>
  );
}
