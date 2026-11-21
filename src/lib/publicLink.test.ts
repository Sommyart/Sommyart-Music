import { describe, expect, it } from "vitest";
import { PUBLIC_SITE, publicOrigin } from "./publicLink";
import { shouldOfferApp } from "./installOffer";
import { withMeta } from "../../api/share";

describe("share links", () => {
  it("uses the public site inside the Android app", () => {
    expect(publicOrigin("https://localhost")).toBe(PUBLIC_SITE);
    expect(publicOrigin("capacitor://localhost")).toBe(PUBLIC_SITE);
    expect(publicOrigin("")).toBe(PUBLIC_SITE);
  });
  it("keeps the website's own address on the web", () => {
    expect(publicOrigin("https://sommyart-music.vercel.app")).toBe("https://sommyart-music.vercel.app");
  });
});

describe("install banner", () => {
  it("shows on Android and computer browsers, not inside the app or on iPhone", () => {
    expect(shouldOfferApp(false, "Mozilla/5.0 (Linux; Android 14)")).toBe(true);
    expect(shouldOfferApp(false, "Mozilla/5.0 (Windows NT 10.0)")).toBe(true);
    expect(shouldOfferApp(true, "Mozilla/5.0 (Linux; Android 14)")).toBe(false);
    expect(shouldOfferApp(false, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toBe(false);
  });
});

describe("link preview card", () => {
  const page = `<html><head><title>Sommyart Music</title>
    <meta name="description" content="old">
    <meta property="og:title" content="old">
    <meta name="twitter:image" content="old.png">
  </head><body></body></html>`;
  it("puts the song's title and cover in place of the site-wide ones", () => {
    const out = withMeta(page, {
      title: `Mi Corazón · Sommy "Art"`, description: "Listen", image: "https://pub.example/c.png",
      url: "https://sommyart-music.vercel.app/song/1", type: "music.song",
    });
    expect(out).toContain('<meta property="og:title" content="Mi Corazón · Sommy &quot;Art&quot;">');
    expect(out).toContain('<meta property="og:image" content="https://pub.example/c.png">');
    expect(out).not.toContain('content="old"');
    expect(out).not.toContain("old.png");
    expect(out).toContain("<title>Mi Corazón · Sommy &quot;Art&quot; | Sommyart Music</title>");
  });
});

import { pathFromLink } from "./appLinks";
describe("opening shared links in the app", () => {
  it("turns a shared song or album link into the app page", () => {
    expect(pathFromLink("https://sommyart-music.vercel.app/song/8b17f2bf-bd07-472c-9510-cd19c271b6ac")).toBe("/song/8b17f2bf-bd07-472c-9510-cd19c271b6ac");
    expect(pathFromLink("https://sommyart-music.vercel.app/album/1a09bcd7-6dc2-4c1f-a6d3-aa0c73035266?1")).toBe("/album/1a09bcd7-6dc2-4c1f-a6d3-aa0c73035266");
  });
  it("ignores other links", () => {
    expect(pathFromLink("https://example.com/song/8b17f2bf-bd07-472c-9510-cd19c271b6ac")).toBeNull();
    expect(pathFromLink("https://sommyart-music.vercel.app/profile")).toBeNull();
    expect(pathFromLink("not a link")).toBeNull();
  });
});
