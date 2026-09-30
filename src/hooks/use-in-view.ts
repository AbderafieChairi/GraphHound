import { useEffect, useRef, useState } from "react";

/**
 * Track whether an element has entered the viewport. Once it has, the hook
 * latches to `true` and stops observing — callers use this to defer expensive
 * work (running a query, mounting a graph canvas) until a card is actually
 * scrolled into view, instead of doing it for every card at once on mount.
 *
 * `rootMargin` lets work start slightly before the element is visible so it
 * feels instant when it scrolls in.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "200px",
): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return; // Already latched; nothing more to observe.
    const el = ref.current;
    if (!el) return;

    // Environments without IntersectionObserver (e.g. SSR/old runtimes) should
    // still show content — fall back to eagerly marking it visible.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
