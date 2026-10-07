import { createClient } from "@supabase/supabase-js";
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  apiUrl: import.meta.env.VITE_OUTREACH_API_URL || "",
  importUrl: import.meta.env.VITE_OUTREACH_IMPORT_URL || "",
  appUrl: import.meta.env.VITE_APP_URL || window.location.origin,
  timezone: import.meta.env.VITE_DEFAULT_TIMEZONE || "Asia/Karachi",
};
export const configured = Boolean(
  config.supabaseUrl &&
  config.publishableKey &&
  config.apiUrl &&
  config.importUrl,
);
// Auth tokens live only in this tab's session storage, never localStorage. WASender keys are never persisted by the browser.
export const supabase = configured
  ? createClient(config.supabaseUrl, config.publishableKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export type Row = Record<string, any>;
export async function continueWithGoogle() {
  if (!supabase) throw new Error("Sign-in is unavailable. Please try again later.");
  const settingsResponse = await fetch(config.supabaseUrl + "/auth/v1/settings", {
    headers: { apikey: config.publishableKey },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!settingsResponse.ok || (await settingsResponse.json()).external?.google !== true)
    throw new Error("Google sign-in is unavailable. Please use email for now.");
  const redirectTo = new URL(
    "/login",
    import.meta.env.DEV ? window.location.origin : config.appUrl,
  ).href;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in is unavailable. Please use email for now.");
  const destination = new URL(data.url);
  if (destination.origin !== new URL(config.supabaseUrl).origin ||
      destination.pathname !== "/auth/v1/authorize")
    throw new Error("Google sign-in is unavailable. Please use email for now.");
  window.location.assign(destination.href);
}
export const rows = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
export const label = (v: unknown): string => (typeof v === "string" ? v : "");
export const count = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
export class OutreachError extends Error {
  code: string;
  requestId: string;
  constructor(message: string, code: string, requestId: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}
const writes = new Set([
  "workspaceCreate",
  "workspaceUpdate",
  "profileUpdate",
  "sessionCreate",
  "sessionConnect",
  "sessionDisconnect",
  "sessionDelete",
  "create",
  "start",
  "pause",
  "resume",
  "stop",
  "delete",
  "saveTemplate",
  "deleteTemplate",
  "suppress",
  "reply",
  "markConversationRead",
]);
const pendingIds = new Map<string, string>();
const running = new Map<string, Promise<any>>();
async function token() {
  if (!supabase)
    throw new Error(
      "Application setup is incomplete. Contact EightBit support.",
    );
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session)
    throw new OutreachError("Sign in to continue.", "UNAUTHORIZED", "");
  return session;
}
async function envelope(response: Response) {
  let data: Row;
  try {
    data = await response.json();
  } catch {
    throw new OutreachError(
      "The server returned an invalid response. Refresh before retrying.",
      "BACKEND_UNAVAILABLE",
      "",
    );
  }
  if (!response.ok || data.success !== true)
    throw new OutreachError(
      label(data.error?.message) || "Unable to complete this action.",
      label(data.error?.code) || "BACKEND_UNAVAILABLE",
      label(data.requestId),
    );
  return data.data;
}
export async function action(
  actionName: string,
  workspaceId?: string,
  payload: Row = {},
) {
  const session = await token();
  const body = {
    ...payload,
    action: actionName,
    ...(workspaceId ? { workspaceId } : {}),
  };
  delete (body as Row).userId;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  const key =
    session.user.id +
    ":" +
    Array.from(new Uint8Array(digest))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  if (running.has(key)) return running.get(key);
  const requestId = pendingIds.get(key) || crypto.randomUUID();
  if (writes.has(actionName)) pendingIds.set(key, requestId);
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch(
        import.meta.env.DEV ? "/v2-api" : config.apiUrl,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + session.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, requestId }),
          signal: controller.signal,
        },
      );
      const data = await envelope(response);
      pendingIds.delete(key);
      return data;
    } catch (e) {
      if (e instanceof OutreachError) {
        if (!["BACKEND_UNAVAILABLE", "REQUEST_CONFLICT"].includes(e.code))
          pendingIds.delete(key);
        throw e;
      }
      throw new OutreachError(
        writes.has(actionName)
          ? "Connection interrupted. Refresh before retrying; your action may have completed."
          : "Unable to refresh your data. Check your connection and try again.",
        "BACKEND_UNAVAILABLE",
        requestId,
      );
    } finally {
      clearTimeout(timer);
    }
  })();
  running.set(key, task);
  try {
    return await task;
  } finally {
    running.delete(key);
  }
}
export async function list(
  actionName: string,
  workspaceId: string,
  payload: Row = {},
) {
  const result: Row[] = [];
  for (let offset = 0; offset < 100000; offset += 200) {
    const data = await action(actionName, workspaceId, {
      ...payload,
      limit: 200,
      offset,
    });
    if (!Array.isArray(data))
      throw new Error("Invalid list response; previous data retained.");
    result.push(...rows(data));
    if (data.length < 200) return result;
  }
  throw new Error("Too many records. Narrow the selection.");
}
const uploadIds = new WeakMap<File, Map<string, string>>();
export async function importContacts(
  workspaceId: string,
  campaignId: string,
  file: File,
) {
  if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 5 * 1024 * 1024)
    throw new Error("Choose a CSV or XLSX file up to 5 MB.");
  const session = await token();
  const ids = uploadIds.get(file) || new Map<string, string>();
  uploadIds.set(file, ids);
  const scope = workspaceId + ":" + campaignId;
  const requestId = ids.get(scope) || crypto.randomUUID();
  ids.set(scope, requestId);
  const url = new URL(
    import.meta.env.DEV ? "/v2-import" : config.importUrl,
    window.location.origin,
  );
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("campaignId", campaignId);
  url.searchParams.set("requestId", requestId);
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const result = await envelope(response);
  ids.delete(scope);
  return result;
}
const mediaUploads = new WeakMap<File, Map<string, Promise<{ url: string; mime: string; filename: string; size: number }>>>();
export function uploadMedia(workspaceId: string, file: File) {
  const scoped = mediaUploads.get(file) || new Map();
  mediaUploads.set(file, scoped);
  const existing = scoped.get(workspaceId);
  if (existing) return existing;
  const pending = uploadMediaOnce(workspaceId, file).catch(error => { scoped.delete(workspaceId); throw error; });
  scoped.set(workspaceId, pending);
  return pending;
}
async function uploadMediaOnce(workspaceId: string, file: File) {
  if (!supabase) throw new Error("Media upload is unavailable. Please try again later.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Attachments must be 100 MB or smaller.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "attachment";
  const path = `${workspaceId}/${crypto.randomUUID()}-${safe}`;
  const fallbackMime: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", "3gp": "video/3gpp", aac: "audio/aac", mp3: "audio/mpeg", ogg: "audio/ogg", amr: "audio/amr", pdf: "application/pdf", txt: "text/plain", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  const mime = file.type || fallbackMime[file.name.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream";
  const { error } = await supabase.storage.from("outreach-media").upload(path, file, { upsert: false, contentType: mime });
  if (error) throw new Error("The attachment could not be uploaded. Please try again.");
  // Persist an object reference, never an expiring download token. The worker
  // signs it immediately before delivery; the dashboard signs previews on demand.
  const url = `${config.supabaseUrl}/storage/v1/object/authenticated/outreach-media/${path}`;
  return { url, mime, filename: file.name, size: file.size };
}

export async function resolveMediaUrl(url: string) {
  const prefix = `${config.supabaseUrl}/storage/v1/object/authenticated/outreach-media/`;
  if (!url.startsWith(prefix)) return url;
  if (!supabase) throw new Error("Attachment preview is unavailable.");
  const path = url.slice(prefix.length);
  const { data, error } = await supabase.storage.from("outreach-media").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("Attachment preview is unavailable.");
  return data.signedUrl;
}
