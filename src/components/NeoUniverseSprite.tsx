"use client";

import { useEffect, useRef } from "react";

export type NeoUniverseAnimation =
  | "analyze"
  | "ask"
  | "ask-alt"
  | "confirm"
  | "explain"
  | "idle"
  | "listen"
  | "move"
  | "product"
  | "recommend"
  | "presentation"
  | "walk";

type Props = {
  animation: NeoUniverseAnimation;
  className?: string;
  flipX?: boolean;
};

const SPRITES: Record<NeoUniverseAnimation, string> = {
  analyze: "/neo-universe/analyze.webp",
  ask: "/neo-universe/ask.webp",
  "ask-alt": "/neo-universe/ask-alt.webp",
  confirm: "/neo-universe/confirm.webp",
  explain: "/neo-universe/explain.webp",
  idle: "/neo-universe/idle.webp",
  listen: "/neo-universe/listen.webp",
  move: "/neo-universe/move.webp",
  product: "/neo-universe/product.webp",
  presentation: "/neo-universe/product.webp",
  recommend: "/neo-universe/recommend.webp",
  walk: "/neo-universe/move.webp",
};

const FRAME_COUNT = 36;
const LOOP_DURATION_MS = 3000;

export default function NeoUniverseSprite({ animation, className = "", flipX = false }: Props) {
  const spriteRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    sprite.style.backgroundPosition = "0% 0%";
    let disposed = false;
    let requestId = 0;
    let lastFrame = -1;

    const startAnimation = () => {
      if (disposed) return;
      const startedAt = performance.now();
      const drawNextFrame = (now: number) => {
        const elapsed = (now - startedAt) % LOOP_DURATION_MS;
        const frame = Math.min(FRAME_COUNT - 1, Math.floor((elapsed / LOOP_DURATION_MS) * FRAME_COUNT));
        if (frame !== lastFrame) {
          lastFrame = frame;
          const row = Math.floor(frame / 6);
          const column = frame % 6;
          sprite.style.backgroundPosition = `${column * 20}% ${row * 20}%`;
        }
        requestId = window.requestAnimationFrame(drawNextFrame);
      };
      requestId = window.requestAnimationFrame(drawNextFrame);
    };

    // Decode a newly selected sheet before starting its 3-second loop so the
    // first visible frames do not stutter while the browser decodes the WebP.
    const image = new Image();
    image.src = SPRITES[animation];
    if (typeof image.decode === "function") {
      void image.decode().catch(() => undefined).then(startAnimation);
    } else if (image.complete) {
      startAnimation();
    } else {
      image.addEventListener("load", startAnimation, { once: true });
    }

    return () => {
      disposed = true;
      image.removeEventListener("load", startAnimation);
      window.cancelAnimationFrame(requestId);
    };
  }, [animation]);

  return (
    <span
      ref={spriteRef}
      aria-hidden="true"
      className={`block shrink-0 bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("${SPRITES[animation]}")`,
        backgroundSize: "600% 600%",
        backgroundPosition: "0% 0%",
        transform: flipX ? "scaleX(-1)" : undefined,
      }}
    />
  );
}
