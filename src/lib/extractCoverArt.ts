import jsmediatags from "jsmediatags";

const coverCache = new Map<string, string>();

export function extractCoverArt(audioUrl: string): Promise<string | null> {
  if (coverCache.has(audioUrl)) {
    return Promise.resolve(coverCache.get(audioUrl)!);
  }

  return new Promise((resolve) => {
    // Use full URL for jsmediatags
    const fullUrl = audioUrl.startsWith("http")
      ? audioUrl
      : `${window.location.origin}${audioUrl}`;

    jsmediatags.read(fullUrl, {
      onSuccess(tag) {
        const picture = tag.tags.picture;
        if (picture) {
          const { data, format } = picture;
          const bytes = new Uint8Array(data);
          const blob = new Blob([bytes], { type: format });
          const url = URL.createObjectURL(blob);
          coverCache.set(audioUrl, url);
          resolve(url);
        } else {
          resolve(null);
        }
      },
      onError() {
        resolve(null);
      },
    });
  });
}
