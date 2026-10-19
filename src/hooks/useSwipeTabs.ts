import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** The main screens, in the same order as the bottom bar. */
export const TAB_PATHS = ["/", "/albums", "/playlist", "/downloads"];

const MIN_DISTANCE = 70; // px sideways
const MAX_TIME = 700; // ms
const EDGE_GUARD = 24; // px, leaves the phone's own edge back-swipe alone

/** True when the touch started on something that needs sideways movement itself. */
function startsOnSideways(el: Element | null): boolean {
  while (el && el !== document.body) {
    if (el instanceof HTMLElement) {
      if (el.dataset.noSwipe !== undefined) return true;
      const role = el.getAttribute("role");
      if (role === "slider" || role === "dialog" || role === "menu") return true;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Swipe left or right to move between Home, Albums, Playlist and Downloads.
 * Ignores sliders, horizontally scrolling rows, dialogs and mostly vertical gestures.
 */
export function useSwipeTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      if (!TAB_PATHS.includes(pathRef.current)) return;
      const t = e.touches[0];
      if (t.clientX < EDGE_GUARD || t.clientX > window.innerWidth - EDGE_GUARD) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (startsOnSideways(e.target as Element)) return;
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      start = null;
      if (dt > MAX_TIME || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      const i = TAB_PATHS.indexOf(pathRef.current);
      if (i < 0) return;
      const next = dx < 0 ? i + 1 : i - 1; // swipe left = next tab
      if (next < 0 || next >= TAB_PATHS.length) return;
      navigate(TAB_PATHS[next]);
    };

    const onCancel = () => { start = null; };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [navigate]);
}
