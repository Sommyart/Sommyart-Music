import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { handlers, toastSuccess, rows } = vi.hoisted(() => ({
  handlers: { current: null as null | ((p: any) => void) },
  toastSuccess: vi.fn(),
  rows: [] as any[],
}));

vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("@/contexts/FollowsContext", () => ({ useFollows: () => ({ followedIds: new Set<string>(["a1"]), loading: false }) }));
vi.mock("@/lib/notify", () => ({ getNotifyMode: () => (globalThis as any).__mode ?? "all", showSystemNotification: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => {
  const channel: any = { on: (_e: string, _f: any, cb: any) => { handlers.current = cb; return channel; }, subscribe: () => channel };
  return {
    supabase: {
      from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: rows }) }) }) }),
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});

import { NotificationsProvider, useNotifications } from "./NotificationsContext";

function Probe() {
  const { items, unread } = useNotifications();
  return <div><span data-testid="n">{items.length}</span><span data-testid="u">{unread}</span></div>;
}
const mount = () => render(<MemoryRouter><NotificationsProvider><Probe /></NotificationsProvider></MemoryRouter>);
const insert = (n: any) => act(() => { handlers.current!({ eventType: "INSERT", new: { body: "", route: "/x", artist_id: null, ...n } }); });

beforeEach(() => { localStorage.clear(); rows.length = 0; toastSuccess.mockClear(); (globalThis as any).__mode = "all"; });

describe("notifications", () => {
  it("shows an announcement posted while the app is open, and counts it as unread", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("0"));
    await new Promise((r) => setTimeout(r, 5));
    insert({ id: "1", kind: "announcement", title: "New update", created_at: new Date(Date.now() + 1000).toISOString() });
    expect(screen.getByTestId("n").textContent).toBe("1");
    expect(screen.getByTestId("u").textContent).toBe("1");
    expect(toastSuccess).toHaveBeenCalledWith("New update", expect.anything());
  });

  it("names the artist for a new album", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("0"));
    insert({ id: "2", kind: "album", title: "Somzy just dropped a new album", created_at: new Date(Date.now() + 1000).toISOString() });
    expect(toastSuccess).toHaveBeenCalledWith("Somzy just dropped a new album", expect.anything());
  });

  it("stays quiet when the listener turned notifications off, but still lists them", async () => {
    (globalThis as any).__mode = "off";
    mount();
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("0"));
    insert({ id: "3", kind: "song", title: "X just dropped a new song", created_at: new Date(Date.now() + 1000).toISOString() });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId("n").textContent).toBe("1");
  });

  it("'followed artists only' still lets announcements through", async () => {
    (globalThis as any).__mode = "following";
    mount();
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("0"));
    insert({ id: "4", kind: "song", title: "Other just dropped a new song", artist_id: "zzz", created_at: new Date(Date.now() + 1000).toISOString() });
    expect(toastSuccess).not.toHaveBeenCalled();
    insert({ id: "5", kind: "announcement", title: "News", created_at: new Date(Date.now() + 2000).toISOString() });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });
});
