"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Fades its content up the first time it scrolls into view. */
export default function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only hide content that starts below the screen; anything already in
    // view (or any page without JavaScript) simply shows.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.armed = "true";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.visible = "true";
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
