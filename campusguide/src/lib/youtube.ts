/**
 * Pulls the video id out of the YouTube URL shapes people actually paste:
 * watch links, share links, embeds, and shorts.
 */
export function youtubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const isYouTube = host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com";

  if (host === "youtu.be") {
    return sanitizeId(url.pathname.slice(1));
  }

  if (!isYouTube) return null;

  if (url.pathname === "/watch") {
    return sanitizeId(url.searchParams.get("v") ?? "");
  }

  const embedMatch = /^\/(embed|shorts|live|v)\/([^/]+)/.exec(url.pathname);
  if (embedMatch) return sanitizeId(embedMatch[2]);

  return null;
}

/** YouTube ids are 11 URL-safe characters; anything else is not one. */
function sanitizeId(candidate: string) {
  const id = candidate.trim();
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function youtubeEmbedUrl(videoId: string) {
  // nocookie avoids setting tracking cookies for students who only watch.
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
