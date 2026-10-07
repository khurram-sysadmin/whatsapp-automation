import { useEffect, useState } from "react";
import { resolveMediaUrl } from "./client";

export function MediaPreview({ url, type, filename }: { url: string; type: string; filename?: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setSrc(""); setError(false);
    const refresh = () => void resolveMediaUrl(url).then(value => { if (active) setSrc(value); }).catch(() => { if (active) setError(true); });
    refresh();
    const timer = window.setInterval(refresh, 8 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [url]);
  if (error) return <p className="v2-muted" role="status">Attachment preview unavailable. Refresh to try again.</p>;
  if (!src) return <p className="v2-muted" role="status">Loading attachment…</p>;
  if (type === "image") return <img className="v2-media-preview" src={src} alt={filename || "Image attachment"} referrerPolicy="no-referrer" />;
  if (type === "video") return <video className="v2-media-preview" src={src} controls preload="metadata" />;
  if (type === "audio") return <audio src={src} controls preload="metadata" />;
  return <a href={src} target="_blank" rel="noreferrer">{filename || "Open attachment"}</a>;
}
