"use client";

import { useEffect, useState } from "react";

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
  | "recommend";

type Props = {
  animation: NeoUniverseAnimation;
  className?: string;
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
  recommend: "/neo-universe/recommend.webp",
};

export default function NeoUniverseSprite({ animation, className = "" }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % 36);
    }, 90);
    return () => window.clearInterval(timer);
  }, [animation]);

  const row = Math.floor(frame / 6);
  const column = frame % 6;

  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("${SPRITES[animation]}")`,
        backgroundSize: "600% 600%",
        backgroundPosition: `${column * 20}% ${row * 20}%`,
      }}
    />
  );
}
