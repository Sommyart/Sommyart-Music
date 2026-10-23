const seen = new Set<string>();

/**
 * Quietly loads pictures once the app is idle so the service worker keeps a
 * copy. Offline, those covers then still show. Runs three at a time and never
 * repeats a picture in the same session.
 */
export function prefetchImages(urls: Array<string | null | undefined>) {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const todo = [...new Set(urls)].filter((u): u is string => !!u && /^https?:\/\//.test(u) && !seen.has(u));
  if (!todo.length) return;
  todo.forEach((u) => seen.add(u));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const url = todo[next++];
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = url;
      });
    }
  };
  const run = () => {
    for (let i = 0; i < 3; i++) void worker();
  };
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(run, { timeout: 4000 });
  else w.setTimeout(run, 1500);
}
