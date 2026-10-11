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

export default function NeoUniverseSprite({ animation, className = "", flipX = false }: Props) {
  const spriteRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    sprite.style.backgroundPosition = "0% 0%";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Keep sprite feedback visible for users who request reduced motion, but
    // slow it down. The companion's viewport roaming is disabled separately.
    const frameDuration = reducedMotion ? 240 : animation === "idle" || animation === "listen" ? 120 : 82;
    let frame = 0;
    let lastFrameAt = performance.now();
    let requestId = 0;
    const drawNextFrame = (now: number) => {
      if (now - lastFrameAt >= frameDuration) {
        const elapsedFrames = Math.floor((now - lastFrameAt) / frameDuration);
        frame = (frame + elapsedFrames) % 36;
        lastFrameAt += elapsedFrames * frameDuration;
        const row = Math.floor(frame / 6);
        const column = frame % 6;
        sprite.style.backgroundPosition = `${column * 20}% ${row * 20}%`;
      }
      requestId = window.requestAnimationFrame(drawNextFrame);
    };
    requestId = window.requestAnimationFrame(drawNextFrame);
    return () => window.cancelAnimationFrame(requestId);
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
