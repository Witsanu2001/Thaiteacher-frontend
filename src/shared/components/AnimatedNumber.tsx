import { useEffect, useRef, useState } from "react";

const integer = (value: number) => Math.round(value).toLocaleString("th-TH");

export default function AnimatedNumber({ value, format = integer, duration = 850 }: {
  value: number;
  format?: (value: number) => string;
  duration?: number;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [displayed, setDisplayed] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? safeValue : 0);
  const displayedRef = useRef(displayed);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const start = displayedRef.current;
    if (start === target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = reduced ? 1 : Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = progress === 1 ? target : start + (target - start) * eased;
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <><span aria-hidden="true">{format(displayed)}</span><span className="sr-only">{format(safeValue)}</span></>;
}
