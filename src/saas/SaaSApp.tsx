import React, { useCallback, useEffect, useRef, useState } from "react";
import { EightbitLogo } from "../components/ui/Logo";
import {
  action,
  configured,
  config,
  continueWithGoogle,
  OutreachError,
  count,
  importContacts,
  uploadMedia,
  label,
  list,
  rows,
  supabase,
} from "./client";
import type { Row } from "./client";
import {
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Smartphone,
  X,
  LayoutDashboard,
  Send,
  Users,
  MessageSquare,
  FileText,
  ChartNoAxesCombined,
  UserRound,
  CreditCard,
  Settings,
  Inbox,
} from "lucide-react";
import "./saas.css";
import { TIME_ZONES, timeZoneLabel } from "../utils/timezones";
import { MessageEditor, mediaDraftFromRow, type MediaDraft } from "./MessageEditor";
import { MediaPreview } from "./MediaPreview";
import { CampaignProgress } from "./CampaignProgress";
import { AutomaticConnection } from "./AutomaticConnection";
export function OnboardingWelcome({ checking = false }: { checking?: boolean }) {
  return (
    <div className="v2-welcome v2-welcome-loading" role="status">
      <span className="v2-welcome-symbol" aria-hidden="true"><MessageSquare size={22} /></span>
      <h1 className="v2-welcome-line">Welcome to EightBit.</h1>
      <p className="v2-welcome-line">{checking ? "Checking your sign-in…" : "Opening your workspace…"}</p>
      <p className="v2-welcome-line v2-muted">Your contacts, campaigns and conversations, together.</p>
    </div>
  );
}
function useDialogFocus(open: boolean, onClose: () => void, busy: boolean) {
  const state = useRef({ onClose, busy });
  useEffect(() => {
    state.current = { onClose, busy };
  }, [onClose, busy]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      '.v2-overlay [role="dialog"]',
    );
    if (!dialog) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        ),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !state.current.busy) {
        event.preventDefault();
        state.current.onClose();
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = oldOverflow;
      dialog.removeEventListener("keydown", keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
}
function CampaignForm({
  workspaceId,
  sessions,
  templates,
  onCreate,
  onClose,
  testSession,
}: {
  workspaceId: string;
  sessions: Row[];
  templates: Row[];
  onCreate: (v: Row, file: File | null) => Promise<void>;
  onClose: () => void;
  testSession?: Row | null;
}) {
  const [name, setName] = useState(
      testSession ? "Connection test — " + testSession.displayName : "",
    ),
    [whatsappSessionId, setSession] = useState(
      testSession?.whatsappSessionId || "",
    ),
    [template, setTemplate] = useState(
      testSession ? "This is your EightBit WhatsApp connection test." : "",
    ),
    [timezone, setTimezone] = useState(config.timezone),
    [sendingStartTime, setStart] = useState("09:00"),
    [sendingEndTime, setEnd] = useState("17:00"),
    [sendIntervalSeconds, setInterval] = useState("120"),
    [file, setFile] = useState<File | null>(null),
    [media, setMedia] = useState<MediaDraft>(null),
    [phoneE164, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useDialogFocus(true, onClose, busy);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        !sessions.some(
          (s) =>
            s.whatsappSessionId === whatsappSessionId &&
            s.configured &&
            s.status === "connected",
        )
      )
        throw new Error("Choose a connected WhatsApp number first.");
      if (
        !Number.isInteger(Number(sendIntervalSeconds)) ||
        Number(sendIntervalSeconds) < 15 ||
        Number(sendIntervalSeconds) > 86400
      )
        throw new Error(
          "Choose a send interval between 15 and 86,400 seconds.",
        );
      if (testSession && !/^\+[1-9]\d{7,14}$/.test(phoneE164))
        throw new Error("Use an international number with + and country code.");
      if (
        testSession &&
        !confirm("Send this test to " + phoneE164 + "?\n\n" + template)
      )
        return;
      let upload = file;
      if (testSession)
        upload = new File(
          [
            'name,first_name,company,phone,email,city,industry\nTest,Test,,"' +
              phoneE164 +
              '",,,\n',
          ],
          "connection-test.csv",
          { type: "text/csv" },
        );
      const uploaded = media?.file ? await uploadMedia(workspaceId, media.file) : media;
      await onCreate(
        {
          name,
          whatsappSessionId,
          template,
          timezone,
          sendingStartTime: testSession ? "00:00" : sendingStartTime,
          sendingEndTime: testSession ? "23:59" : sendingEndTime,
          sendIntervalSeconds: Number(sendIntervalSeconds),
          isTest: Boolean(testSession),
          ...(uploaded ? { mediaType: media?.type, mediaUrl: uploaded.url, mediaMime: uploaded.mime, mediaFilename: uploaded.filename, mediaSizeBytes: uploaded.size } : {}),
        },
        upload,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="v2-overlay">
      <section
        className="v2-card v2-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New campaign"
      >
        <div className="v2-section-head">
          <h2>{testSession ? "Test connection" : "New campaign"}</h2>
          <button aria-label="Close campaign" onClick={onClose} disabled={busy}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <Field
            name="Campaign name"
            value={name}
            onChange={setName}
            required
          />
          <label className="v2-field">
            WhatsApp connection
            <select
              value={whatsappSessionId}
              onChange={(e) => setSession(e.target.value)}
              required
            >
              <option value="">Choose a connected number</option>
              {sessions
                .filter((s) => s.configured && s.status === "connected")
                .map((s) => (
                  <option key={s.whatsappSessionId} value={s.whatsappSessionId}>
                    {s.displayName} · {s.phoneE164}
                  </option>
                ))}
            </select>
          </label>
          {testSession ? (
            <Field
              name="Your test recipient (with country code)"
              value={phoneE164}
              onChange={setPhone}
              required
            />
          ) : (
            <>
              <label className="v2-field">
                Saved template
                <select
                  onChange={(e) => {
                    const t = templates.find(
                      (t) => t.templateId === e.target.value,
                    );
                    setTemplate(t?.body || "");
                    setMedia(mediaDraftFromRow(t));
                  }}
                  defaultValue=""
                >
                  <option value="">Write your own message</option>
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="v2-field">
                Contacts file
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <p className="v2-muted">
                <a href="/lead-import-example.csv" download>Download an example spreadsheet</a>. Replace its example leads with your own. Columns: name, first_name, company, phone, email, city,
                industry. Use text cells and international phones. Up to 5 MB /
                5,000 rows.
              </p>
            </>
          )}
          <MessageEditor disabled={busy} value={template} onChange={setTemplate} media={media} onMediaChange={setMedia} />
          <div className="v2-form-grid">
            <Field
              name="Timezone"
              value={timezone}
              onChange={setTimezone}
              options={TIME_ZONES.map((zone) => ({ value: zone, label: timeZoneLabel(zone) }))}
              required
            />
            <Field
              name="Send interval (seconds)"
              type="number"
              min={15}
              max={86400}
              value={sendIntervalSeconds}
              onChange={setInterval}
              required
            />
            {!testSession && (
              <>
                <Field
                  name="Sending start"
                  type="time"
                  value={sendingStartTime}
                  onChange={setStart}
                  required
                />
                <Field
                  name="Sending end"
                  type="time"
                  value={sendingEndTime}
                  onChange={setEnd}
                  required
                />
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="v2-error">
              {error}
            </p>
          )}
          <button className="v2-primary" disabled={busy}>
            {busy
              ? "Saving…"
              : testSession
                ? "Confirm test message"
                : "Create draft campaign"}
          </button>
        </form>
      </section>
    </div>
  );
}
const navigation = [
  "Dashboard",
  "Campaigns",
  "Contacts",
  "Inbox",
  "WhatsApp Accounts",
  "Templates",
  "Analytics",
  "Team",
  "Billing",
  "Settings",
] as const;
type Page = (typeof navigation)[number];
const pageDetails: Record<
  Page,
  { icon: typeof Smartphone; description: string }
> = {
  Dashboard: {
    icon: LayoutDashboard,
    description: "Your outreach activity at a glance.",
  },
  Campaigns: {
    icon: Send,
    description: "Create campaigns and follow every message.",
  },
  Contacts: {
    icon: Users,
    description:
      "Manage your company’s contacts and communication preferences.",
  },
  Inbox: {
    icon: MessageSquare,
    description: "Keep customer conversations together.",
  },
  "WhatsApp Accounts": {
    icon: Smartphone,
    description: "Connect and manage your company’s WhatsApp numbers.",
  },
  Templates: {
    icon: FileText,
    description: "Save messages your team can use again.",
  },
  Analytics: {
    icon: ChartNoAxesCombined,
    description: "Track sending, delivery and customer responses.",
  },
  Team: {
    icon: UserRound,
    description: "Manage access to your company account.",
  },
  Billing: {
    icon: CreditCard,
    description: "Review your subscription and monthly usage.",
  },
  Settings: {
    icon: Settings,
    description: "Manage your profile, company and account security.",
  },
};
const displayStatus = (value: unknown) =>
  String(
    (
      {
        leased: "Queued",
        dispatching: "Sending",
        valid: "Ready",
        unknown: "Needs review",
        needsReview: "Needs review",
        pending_partner: "Setup required",
      } as Record<string, string>
    )[String(value)] ||
      value ||
      "Pending",
  )
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="v2-empty">
      <Inbox size={28} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Unable to complete this action.";
const date = (v: unknown) =>
  label(v) && Number.isFinite(Date.parse(label(v)))
    ? new Date(label(v)).toLocaleString()
    : "—";
const route = (): Page =>
  navigation.find(
    (p) =>
      p.toLowerCase().replaceAll(" ", "-") ===
      (location.hash.slice(1) ||
        location.pathname.replace(/^\//, "").replace(/\/$/, "")),
  ) || "Dashboard";
function Field({
  name,
  type = "text",
  value,
  onChange,
  required = false,
  min,
  max,
  autoComplete,
  minLength,
  options,
}: {
  name: string;
  type?: string;
  value: string;
  onChange: (s: string) => void;
  required?: boolean;
  min?: number;
  max?: number;
  autoComplete?: string;
  minLength?: number;
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="v2-field">
      {name}
      {options ? <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        minLength={minLength}
        autoComplete={
          autoComplete || (type === "password" ? "new-password" : undefined)
        }
      />}
    </label>
  );
}

function AnalyticsSummary({ stats }: { stats: Row }) {
  const sent = count(stats.sent),
    statusKeys = ["sent", "delivered", "read", "failed", "needsReview"];
  const maximum = Math.max(1, ...statusKeys.map((key) => count(stats[key])));
  return (
    <div className="v2-grid">
      <section className="v2-card">
        <h2>Message outcomes</h2>
        <p className="v2-muted">
          Recorded outcomes for your current campaign history.
        </p>
        {statusKeys.map((key) => (
          <div className="v2-analytics-row" key={key}>
            <div className="v2-row-button">
              <span>{displayStatus(key)}</span>
              <strong>{count(stats[key]).toLocaleString()}</strong>
            </div>
            <div className="v2-bar" aria-hidden="true">
              <span
                style={{ width: (count(stats[key]) / maximum) * 100 + "%" }}
              />
            </div>
          </div>
        ))}
      </section>
      <section className="v2-card">
        <h2>Delivery and engagement</h2>
        <div className="v2-form-grid">
          {[
            ["Delivery rate", stats.delivered],
            ["Read rate", stats.read],
          ].map(([name, value]) => (
            <p key={String(name)}>
              {name}
              <br />
              <strong className="v2-rate">
                {sent
                  ? Math.min(100, (count(value) / sent) * 100).toFixed(1) + "%"
                  : "—"}
              </strong>
            </p>
          ))}
        </div>
        <p className="v2-muted">
          Rates are based on sent messages. Delivery and read updates appear
          after WhatsApp reports them.
        </p>
        <div className="v2-row-button">
          <span>Inbound replies</span>
          <strong>{count(stats.replied)}</strong>
        </div>
        <div className="v2-row-button">
          <span>Opted-out contacts</span>
          <strong>{count(stats.optedOut)}</strong>
        </div>
        {!sent && (
          <p className="v2-muted">
            Send your first campaign to see delivery rates.
          </p>
        )}
      </section>
    </div>
  );
}
export default function SaaSApp() {
  const [authenticated, setAuthenticated] = useState(false),
    [loadingAuth, setLoadingAuth] = useState(true),
    [recovery, setRecovery] = useState(
      location.pathname.includes("reset-password"),
    ),
    [bootstrap, setBootstrap] = useState<Row | null>(null),
    [workspaceId, setWorkspace] = useState(""),
    [page, setPage] = useState<Page>(route),
    [mobile, setMobile] = useState(false),
    [data, setData] = useState<Row>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [wizard, setWizard] = useState(false),
    [testSession, setTestSession] = useState<Row | null>(null),
    [campaignId, setCampaign] = useState(""),
    [detail, setDetail] = useState<Row | null>(null),
    [conversationId, setConversation] = useState(""),
    [conversation, setThread] = useState<Row | null>(null),
    [replyMedia, setReplyMedia] = useState<MediaDraft>(null),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Row | null>(null);
  const [templateMedia, setTemplateMedia] = useState<MediaDraft>(null);
  useEffect(() => { setTemplateMedia(mediaDraftFromRow(editingTemplate)); }, [editingTemplate]);
  const authIdentity = useRef("");
  const generation = useRef(0),
    refreshLock = useRef<Promise<void> | null>(null),
    detailGeneration = useRef(0),
    selectedId = useRef(""),
    workspaceRef = useRef("");
  useEffect(() => {
    selectedId.current = campaignId;
    workspaceRef.current = workspaceId;
  }, [campaignId, workspaceId]);
  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }
    let alive = true;
    const auth = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (authIdentity.current !== session?.user.id) {
        authIdentity.current = session?.user.id || "";
        generation.current++;
        setData({});
        setBootstrap(null);
        setWorkspace("");
        setCampaign("");
        setDetail(null);
        setThread(null);
        setConversation("");
      }
      setAuthenticated(Boolean(session));
      setLoadingAuth(false);
      if (!session) {
        generation.current++;
        setData({});
        setBootstrap(null);
        setWorkspace("");
        setCampaign("");
        setDetail(null);
        setThread(null);
        setConversation("");
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (alive) {
          setAuthenticated(Boolean(session));
          setLoadingAuth(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(errorText(e));
          setLoadingAuth(false);
        }
      });
    return () => {
      alive = false;
      auth.data.subscription.unsubscribe();
    };
  }, []);
  const loadBootstrap = useCallback(async (preferred?: string) => {
    const identity = authIdentity.current;
    let b: Row;
    try {
      b = await action("bootstrap");
    } catch (error) {
      if (error instanceof OutreachError && error.code === "UNAUTHORIZED") {
        setAuthenticated(false);
        setBootstrap(null);
        setData({});
        setWorkspace("");
      }
      throw error;
    }
    if (identity !== authIdentity.current) return;
    setBootstrap(b);
    const allowed = rows(b.workspaces);
    setWorkspace((old) =>
      allowed.some((w) => w.workspaceId === (preferred || old))
        ? preferred || old
        : b.currentWorkspaceId || "",
    );
  }, []);
  useEffect(() => {
    if (authenticated && !recovery)
      void loadBootstrap().catch((e) => setError(errorText(e)));
  }, [authenticated, recovery, loadBootstrap]);
  const workspace = rows(bootstrap?.workspaces).find(
      (w) => w.workspaceId === workspaceId,
    ),
    canWrite = ["owner", "admin", "agent"].includes(workspace?.role),
    canManage = ["owner", "admin"].includes(workspace?.role);
  const refresh = useCallback(async () => {
    if (!workspaceId || workspaceRef.current !== workspaceId) return;
    if (refreshLock.current) {
      await refreshLock.current;
      return;
    }
    const current = generation.current;
    setRefreshing(true);
    const fields = [
      "sessionList",
      "list",
      "contacts",
      "inbox",
      "templates",
      "stats",
      "subscription",
      "usage",
    ];
    const task = (async () => {
      const results = await Promise.allSettled(
        fields.map((a) =>
          ["stats", "subscription", "usage"].includes(a)
            ? action(a, workspaceId)
            : list(a, workspaceId),
        ),
      );
      if (
        current !== generation.current ||
        workspaceRef.current !== workspaceId
      )
        return;
      setData((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.status === "fulfilled") next[fields[i]] = r.value;
        });
        return next;
      });
      const failed = results.filter(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult[];
      setError([...new Set(failed.map((r) => errorText(r.reason)))].join(" "));
      setRefreshing(false);
    })();
    refreshLock.current = task;
    try {
      await task;
    } finally {
      refreshLock.current = null;
    }
  }, [workspaceId]);
  useEffect(() => {
    generation.current++;
    setData({});
    setCampaign("");
    setDetail(null);
    setThread(null);
    setConversation("");
    setWizard(false);
    setTestSession(null);
    setSearch("");
    setEditingTemplate(null);
    setTemplateMedia(null);
    setReplyMedia(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (cancelled) return;
      if (refreshLock.current) await refreshLock.current;
      if (cancelled) return;
      await refresh();
      if (!cancelled) timer = setTimeout(poll, 30000);
    };
    void poll();
    return () => {
      cancelled = true;
      generation.current++;
      clearTimeout(timer);
    };
  }, [refresh]);
  const navigate = (next: Page) => {
    setEditingTemplate(null);
    setTemplateMedia(null);
    setNotice("");
    setPage(next);
    setCampaign("");
    setDetail(null);
    setSearch("");
    setMobile(false);
    history.pushState(null, "", "#" + next.toLowerCase().replaceAll(" ", "-"));
  };
  useEffect(() => {
    const sync = () => setPage(route());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const loadDetail = useCallback(async () => {
    if (!campaignId || !workspaceId) return;
    const gen = ++detailGeneration.current;
    const [campaign, messages, contacts, stats] = await Promise.all([
      action("detail", workspaceId, { campaignId }),
      list("messages", workspaceId, { campaignId }),
      list("contacts", workspaceId, { campaignId }),
      action("stats", workspaceId, { campaignId }),
    ]);
    if (
      gen === detailGeneration.current &&
      selectedId.current === campaignId &&
      workspaceRef.current === workspaceId
    )
      setDetail({ campaign, messages, contacts, stats });
  }, [campaignId, workspaceId]);
  const detailStatus = detail?.campaign?.status;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await loadDetail();
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
      if (!cancelled && ["running", "paused"].includes(detailStatus || ""))
        timer = setTimeout(poll, 15000);
    };
    if (campaignId) void poll();
    return () => {
      cancelled = true;
      detailGeneration.current++;
      clearTimeout(timer);
    };
  }, [loadDetail, campaignId, detailStatus]);
  useEffect(() => {
    if (!conversationId || !workspaceId) return;
    let alive = true;
    void action("conversation", workspaceId, { conversationId, limit: 500 })
      .then((t) => {
        if (alive) setThread(t);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [conversationId, workspaceId, data.inbox]);
  const perform = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
      if (campaignId && selectedId.current === campaignId) await loadDetail();
      setNotice("Saved successfully.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const create = async (v: Row, file: File | null) => {
    const c = await action("create", workspaceId, v);
    setCampaign(c.campaignId);
    setPage("Campaigns");
    setWizard(false);
    setTestSession(null);
    if (file) {
      try {
        const imported = await importContacts(workspaceId, c.campaignId, file);
        setNotice(count(imported.imported) + " contacts imported.");
        if (v.isTest)
          await action("start", workspaceId, { campaignId: c.campaignId });
      } catch (e) {
        await refresh();
        setError(
          "Draft created. Import/start could not be confirmed: " +
            errorText(e) +
            " Open the saved draft to continue.",
        );
        return;
      }
    }
    await refresh();
  };
  if (!configured)
    return (
      <div className="v2-onboarding">
        <EightbitLogo />
        <section className="v2-card">
          <h1>Application setup is incomplete</h1>
          <p>
            Please contact EightBit support. Customer accounts do not need
            platform credentials.
          </p>
        </section>
      </div>
    );
  if (loadingAuth)
    return (
      <div className="v2-onboarding" role="status">
        <EightbitLogo />
        <OnboardingWelcome checking />
      </div>
    );
  if (!authenticated || recovery)
    return (
      <Auth
        hasSession={authenticated}
        onSignedIn={() => {
          setAuthenticated(true);
          setRecovery(false);
          history.replaceState(null, "", "/#dashboard");
        }}
      />
    );
  if (!bootstrap)
    return (
      <div className="v2-onboarding">
        <EightbitLogo />
        {error ? (
          <section className="v2-card">
            <p role="alert">{error}</p>
            <button
              onClick={() =>
                void loadBootstrap().catch((e) => setError(errorText(e)))
              }
            >
              Retry
            </button>
          </section>
        ) : (
          <OnboardingWelcome />
        )}
      </div>
    );
  if (!rows(bootstrap.workspaces).length)
    return (
      <Company
        fullName={label(bootstrap.user?.fullName)}
        onCreated={(id) =>
          void loadBootstrap(id).catch((e) => setError(errorText(e)))
        }
      />
    );
  const sessions = rows(data.sessionList),
    campaigns = rows(data.list),
    contacts = rows(data.contacts),
    inbox = rows(data.inbox),
    templates = rows(data.templates),
    stats = data.stats || {},
    usage = data.usage || {},
    subscription = data.subscription || {};
  const filtered = (r: Row) =>
    [r.name, r.firstName, r.company, r.phoneE164, r.email].some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    );
  const campaignActions = (c: Row) => {
    const opts: Record<string, string[]> = {
      draft: ["start", "delete"],
      running: ["pause", "stop"],
      paused: ["resume", "stop", "delete"],
      stopped: ["delete"],
      completed: ["delete"],
    };
    return (
      canWrite &&
      (opts[c.status] || []).map((op) => (
        <button
          disabled={busy}
          key={op}
          onClick={() =>
            void perform(async () => {
              if (
                op === "delete" &&
                !confirm("Delete " + c.name + "? Sending history is retained.")
              )
                return;
              await action(op, workspaceId, { campaignId: c.campaignId });
              if (op === "delete") {
                selectedId.current = "";
                setCampaign("");
                setDetail(null);
              }
            })
          }
        >
          {op[0].toUpperCase() + op.slice(1)}
        </button>
      ))
    );
  };
  return (
    <div className="v2-shell">
      {mobile && (
        <div className="v2-mobile-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={"v2-sidebar " + (mobile ? "open" : "")}>
        <div className="v2-brand">
          <EightbitLogo />
          <button
            className="v2-mobile-toggle"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="v2-workspace">
          <label className="v2-field">
            Company
            <select
              value={workspaceId}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              {rows(bootstrap.workspaces).map((w) => (
                <option key={w.workspaceId} value={w.workspaceId}>
                  {w.companyName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => {
            const Icon = pageDetails[n].icon;
            return (
              <button
                key={n}
                className={page === n ? "active" : ""}
                aria-current={page === n ? "page" : undefined}
                onClick={() => navigate(n)}
              >
                <span className="v2-nav-label">
                  <Icon size={17} aria-hidden="true" />
                  {n}
                </span>
                {n === "Inbox" &&
                  inbox.some((c) => count(c.unreadCount) > 0) && (
                    <span className="v2-badge">
                      {inbox.reduce((a, c) => a + count(c.unreadCount), 0)}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>
        <div className="v2-user">
          <strong>{bootstrap.user?.fullName || bootstrap.user?.email}</strong>
          <button
            aria-label="Sign out"
            onClick={() =>
              void supabase?.auth
                .signOut()
                .then(({ error }) => {
                  if (error) setError(error.message);
                })
                .catch((e) => setError(errorText(e)))
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="v2-main">
        <header className="v2-header">
          <button
            className="v2-mobile-toggle"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1>{page}</h1>
            <p>
              {workspace?.companyName} ·{" "}
              {bootstrap.user?.fullName || bootstrap.user?.email}
            </p>
          </div>
          <div className="v2-actions">
            <span className="v2-muted">
              {
                sessions.filter((s) => s.configured && s.status === "connected")
                  .length
              }{" "}
              numbers connected
            </span>
            <button
              disabled={refreshing}
              aria-label="Refresh data"
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} />
            </button>
            {canWrite && (
              <button
                className="v2-primary"
                onClick={() =>
                  sessions.some((s) => s.configured && s.status === "connected")
                    ? setWizard(true)
                    : navigate("WhatsApp Accounts")
                }
              >
                <Plus size={15} />
                New campaign
              </button>
            )}
          </div>
        </header>
        <main>
          <p className="v2-page-description">{pageDetails[page].description}</p>
          {error && (
            <div className="v2-error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {notice && (
            <p className="v2-notice" role="status">
              {notice}
            </p>
          )}
          {!sessions.some((s) => s.configured) &&
            ["Dashboard", "Campaigns", "Inbox"].includes(page) && (
              <div className="v2-setup-banner">
                <div>
                  <strong>Connect your WhatsApp to get started</strong>
                  <p>Company → WhatsApp → Test → Ready</p>
                </div>
                <button
                  className="v2-primary"
                  onClick={() => navigate("WhatsApp Accounts")}
                >
                  Set up connection
                </button>
              </div>
            )}
          {(page === "Dashboard" || page === "Analytics") && (
            <>
              <div className="v2-kpis">
                {[
                  [
                    "WhatsApp Accounts",
                    sessions.filter((s) => s.configured).length,
                  ],
                  [
                    "Active Campaigns",
                    campaigns.filter((c) => c.status === "running").length,
                  ],
                  ["Total Contacts", stats.totalContacts],
                  ["Queued", stats.queued],
                  ["Sent", stats.sent],
                  ["Delivered", stats.delivered],
                  ["Read", stats.read],
                  ["Replied", stats.replied],
                  ["Failed", stats.failed],
                  ["Opted Out", stats.optedOut],
                ].map(([k, v]) => (
                  <article className="v2-card" key={String(k)}>
                    <p>{k}</p>
                    <strong>{count(v).toLocaleString()}</strong>
                  </article>
                ))}
              </div>
              {page === "Dashboard" && (
                <div className="v2-grid">
                  <section className="v2-card">
                    <h2>Recent campaigns</h2>
                    {campaigns.slice(0, 5).map((c) => (
                      <button
                        className="v2-row-button"
                        key={c.campaignId}
                        onClick={() => {
                          navigate("Campaigns");
                          setCampaign(c.campaignId);
                        }}
                      >
                        {c.name}
                        <span className={"v2-status " + c.status}>
                          {c.status}
                        </span>
                      </button>
                    ))}
                    {!campaigns.length && (
                      <EmptyState
                        title="Your next campaign starts here"
                        description="Connect a number, add your contacts and create a draft."
                      />
                    )}
                  </section>
                  <section className="v2-card">
                    <h2>Monthly usage</h2>
                    <p>
                      {count(usage.messagesSent)} messages sent ·{" "}
                      {data.subscription == null
                        ? "Usage limit unavailable"
                        : subscription.monthlyMessageLimit == null
                          ? "No fixed cap"
                          : count(subscription.monthlyMessageLimit) +
                            " message limit"}
                    </p>
                    <p>{count(usage.contactsImported)} contacts imported</p>
                    <h3>WhatsApp account status</h3>
                    {sessions.map((s) => (
                      <p key={s.whatsappSessionId}>
                        {s.displayName} ·{" "}
                        <span
                          className={
                            "v2-status " + (s.configured ? s.status : "pending")
                          }
                        >
                          {s.configured
                            ? displayStatus(s.status)
                            : "Setup required"}
                        </span>
                      </p>
                    ))}
                  </section>
                  <section className="v2-card">
                    <h2>Recent conversations</h2>
                    {!inbox.length && (
                      <EmptyState
                        title="No conversations yet"
                        description="Customer replies will appear here once your number is connected."
                      />
                    )}
                    {inbox.slice(0, 5).map((c) => (
                      <button
                        className="v2-row-button"
                        key={c.conversationId}
                        onClick={() => {
                          navigate("Inbox");
                          setConversation(c.conversationId);
                        }}
                      >
                        {c.contact?.name || c.contact?.phoneE164}
                        <span>{c.lastMessage}</span>
                      </button>
                    ))}
                  </section>
                  <section className="v2-card">
                    <h2>Message performance</h2>
                    {["sent", "delivered", "read", "failed", "needsReview"].map(
                      (k) => (
                        <div className="v2-row-button" key={k}>
                          {displayStatus(k)}
                          <strong>{count(stats[k])}</strong>
                        </div>
                      ),
                    )}
                    <p className="v2-muted">
                      Uncertain sends require review and are never retried
                      automatically.
                    </p>
                  </section>
                </div>
              )}
              {page === "Analytics" && <AnalyticsSummary stats={stats} />}
            </>
          )}
          {page === "WhatsApp Accounts" && (
            <Connections
              key={workspaceId}
              workspaceId={workspaceId}
              sessions={sessions}
              onRefresh={refresh}
              canManage={canManage}
              onTest={(s) => {
                setTestSession(s);
                setWizard(true);
              }}
            />
          )}
          {page === "Campaigns" && !campaignId && (
            <section className="v2-card">
              <div className="v2-section-head">
                <h2>Campaigns</h2>
                <input
                  aria-label="Search campaigns"
                  placeholder="Search campaigns"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="v2-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Number</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.filter(filtered).map((c) => (
                      <tr key={c.campaignId}>
                        <td>
                          <button onClick={() => setCampaign(c.campaignId)}>
                            {c.name}
                          </button>
                        </td>
                        <td>
                          {sessions.find(
                            (s) => s.whatsappSessionId === c.whatsappSessionId,
                          )?.displayName || "Removed connection"}
                        </td>
                        <td>
                          <span className={"v2-status " + c.status}>
                            {c.status}
                          </span>
                        </td>
                        <td>{date(c.createdAt)}</td>
                        <td>
                          <div className="v2-actions">{campaignActions(c)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!campaigns.filter(filtered).length && (
                <EmptyState
                  title={search ? "No matching campaigns" : "No campaigns yet"}
                  description={
                    search
                      ? "Try another campaign name."
                      : "Create your first campaign after connecting a WhatsApp number."
                  }
                />
              )}
            </section>
          )}
          {page === "Campaigns" && campaignId && (
            <section className="v2-card">
              <button
                onClick={() => {
                  setCampaign("");
                  setDetail(null);
                }}
              >
                ← All campaigns
              </button>
              {detail ? (
                <>
                  <div className="v2-section-head">
                    <div>
                      <h2>{detail.campaign?.name}</h2>
                      <span className={"v2-status " + detail.campaign?.status}>
                        {detail.campaign?.status}
                      </span>
                    </div>
                    <div className="v2-actions">
                      {campaignActions(detail.campaign)}
                    </div>
                  </div>
                  <p>{detail.campaign?.template}</p>
                  {detail.campaign?.mediaUrl && <MediaPreview url={detail.campaign.mediaUrl} type={detail.campaign.mediaType} filename={detail.campaign.mediaFilename} />}
                  <p className="v2-muted">
                    {detail.campaign?.timezone} ·{" "}
                    {detail.campaign?.sendingStartTime}–
                    {detail.campaign?.sendingEndTime} · every{" "}
                    {detail.campaign?.sendIntervalSeconds} seconds
                  </p>
                  {canWrite && detail.campaign?.status === "draft" && (
                    <label className="v2-field">
                      Import more contacts
                      <input
                        type="file"
                        accept=".csv,.xlsx"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void perform(() =>
                              importContacts(workspaceId, campaignId, file),
                            );
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  <CampaignProgress stats={detail.stats || {}} status={detail.campaign?.status || "draft"} />
                  <h3>Messages</h3>
                  <div className="v2-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Recipient</th>
                          <th>Message</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows(detail.messages).map((m) => (
                          <tr key={m.messageId}>
                            <td>{m.phoneE164}</td>
                            <td>{m.personalizedMessage}{m.mediaType && <small className="v2-message-attachment-label">{m.mediaType === 'audio' ? 'Voice note' : m.mediaFilename || 'Attachment'}</small>}</td>
                            <td>
                              {['sent','delivered','read'].includes(m.status) ? 'Sent' : ['queued','leased','dispatching'].includes(m.status) ? 'Queued' : displayStatus(m.status)}
                              {m.error && <p className="v2-error">{m.error}</p>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {detail.campaign?.status === "completed" && (
                    <p className="v2-notice">
                      Completed. Create a new campaign to send again.
                    </p>
                  )}
                </>
              ) : (
                <p role="status">Loading campaign…</p>
              )}
            </section>
          )}
          {page === "Contacts" && (
            <section className="v2-card">
              <div className="v2-section-head">
                <h2>
                  Contacts{" "}
                  <span className="v2-badge">
                    {contacts.length.toLocaleString()}
                  </span>
                </h2>
                <input
                  aria-label="Search contacts"
                  placeholder="Name, company, phone or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <p className="v2-muted">
                Import contacts through a draft campaign. Opted-out contacts are
                excluded from sending.
              </p>
              <div className="v2-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Name",
                        "Company",
                        "Phone",
                        "Email",
                        "City",
                        "Industry",
                        "Status",
                        "",
                      ].map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!contacts.filter(filtered).length && (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState
                            title={
                              search
                                ? "No matching contacts"
                                : "Your contact list is empty"
                            }
                            description={
                              search
                                ? "Try another name, company, phone number or email."
                                : "Import your contacts into a draft campaign to get started."
                            }
                          />
                        </td>
                      </tr>
                    )}
                    {contacts.filter(filtered).map((c) => (
                      <tr key={c.contactId}>
                        <td>{c.name || c.firstName || c.phoneE164}</td>
                        <td>{c.company || "—"}</td>
                        <td>{c.phoneE164}</td>
                        <td>{c.email || "—"}</td>
                        <td>{c.city || "—"}</td>
                        <td>{c.industry || "—"}</td>
                        <td>
                          <span className={"v2-status " + c.status}>
                            {displayStatus(c.status)}
                          </span>
                        </td>
                        <td>
                          {canWrite && c.status !== "opted_out" && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void perform(async () => {
                                  if (
                                    confirm(
                                      "Opt out " +
                                        c.phoneE164 +
                                        " from all company campaigns?",
                                    )
                                  )
                                    await action("suppress", workspaceId, {
                                      phoneE164: c.phoneE164,
                                      reason:
                                        "Manually opted out by company operator",
                                    });
                                })
                              }
                            >
                              Opt out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === "Inbox" && (
            <div className="v2-inbox">
              <section className="v2-card">
                <h2>Conversations</h2>
                {!inbox.length && (
                  <EmptyState
                    title="No conversations yet"
                    description="New replies from your customers will appear here."
                  />
                )}
                {inbox.map((c) => (
                  <button
                    key={c.conversationId}
                    className={
                      "v2-conversation " +
                      (conversationId === c.conversationId ? "selected" : "")
                    }
                    onClick={() => {
                      setConversation(c.conversationId);
                      setThread(null);
                      if (canWrite)
                        void action("markConversationRead", workspaceId, {
                          conversationId: c.conversationId,
                        })
                          .then(() => refresh())
                          .catch((e) => setError(errorText(e)));
                    }}
                  >
                    <strong>
                      {c.contact?.name ||
                        c.contact?.firstName ||
                        c.contact?.phoneE164}
                    </strong>
                    <span>
                      {c.contact?.company} · {c.contact?.phoneE164}
                    </span>
                    <span>{c.lastMessage}</span>
                    {count(c.unreadCount) > 0 && (
                      <b>{count(c.unreadCount)} unread</b>
                    )}
                  </button>
                ))}
              </section>
              <section className="v2-card">
                {conversation ? (
                  <>
                    <h2>
                      {conversation.contact?.name ||
                        conversation.contact?.phoneE164}
                    </h2>
                    <p>
                      {conversation.contact?.company} ·{" "}
                      {conversation.contact?.phoneE164}
                    </p>
                    <p className="v2-muted">
                      Via{" "}
                      {sessions.find(
                        (s) =>
                          s.whatsappSessionId ===
                          conversation.whatsappSessionId,
                      )?.displayName || "Original connection"}
                    </p>
                    <div className="v2-thread">
                      {rows(conversation.messages).map((m) => (
                        <div
                          className={"v2-bubble " + m.direction}
                          key={m.messageId}
                        >
                          <p>{m.body}</p>
                          {m.mediaUrl && <MediaPreview url={m.mediaUrl} type={m.mediaType} filename={m.mediaFilename} />}
                          <small>
                            {date(m.createdAt)} · {m.status}
                          </small>
                        </div>
                      ))}
                    </div>
                    {canWrite && (
                      <form
                        key={conversationId}
                        className="v2-reply-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const text = String(
                            new FormData(form).get("text") || "",
                          );
                          void perform(async () => {
                            const uploaded = replyMedia?.file ? await uploadMedia(workspaceId, replyMedia.file) : null;
                            await action("reply", workspaceId, {
                              conversationId,
                              text,
                              ...(uploaded ? { mediaType: replyMedia?.type, mediaUrl: uploaded.url, mediaMime: uploaded.mime, mediaFilename: uploaded.filename, mediaSizeBytes: uploaded.size } : {}),
                            });
                            form.reset();
                            setReplyMedia(null);
                            setThread(
                              await action("conversation", workspaceId, {
                                conversationId,
                                limit: 500,
                              }),
                            );
                          });
                        }}
                      >
                        <MessageEditor compact disabled={busy} media={replyMedia} onMediaChange={setReplyMedia} name="text" />
                        <button className="v2-primary" disabled={busy}>
                          Send reply
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title="Your conversations, in one place"
                    description="Choose a conversation to read messages and reply."
                  />
                )}
              </section>
            </div>
          )}
          {page === "Templates" && (
            <>
              <section className="v2-card">
                <div className="v2-section-head">
                  <h2>
                    {editingTemplate ? "Edit template" : "Message templates"}
                  </h2>
                  {editingTemplate && (
                    <button onClick={() => setEditingTemplate(null)}>
                      Cancel editing
                    </button>
                  )}
                </div>
                {canWrite && (
                  <form
                    key={workspaceId + (editingTemplate?.templateId || "new")}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      void perform(async () => {
                        const uploaded = templateMedia?.file ? await uploadMedia(workspaceId, templateMedia.file) : templateMedia;
                        await action("saveTemplate", workspaceId, {
                          name: f.get("name"),
                          body: f.get("body"),
                          ...(uploaded ? { mediaType: templateMedia?.type, mediaUrl: uploaded.url, mediaMime: uploaded.mime, mediaFilename: uploaded.filename, mediaSizeBytes: uploaded.size } : {}),
                        });
                        form.reset();
                        setTemplateMedia(null);
                        setEditingTemplate(null);
                      });
                    }}
                  >
                    <label className="v2-field">
                      Template name
                      <input
                        name="name"
                        required
                        maxLength={200}
                        defaultValue={editingTemplate?.name || ""}
                        readOnly={Boolean(editingTemplate)}
                      />
                    </label>
                    <MessageEditor disabled={busy} name="body" defaultValue={editingTemplate?.body || ""} media={templateMedia} onMediaChange={setTemplateMedia} />
                    <button className="v2-primary" disabled={busy}>
                      Save template
                    </button>
                  </form>
                )}
              </section>
              <div className="v2-grid">
                {templates.map((t) => (
                  <section key={t.templateId} className="v2-card">
                    <h3>{t.name}</h3>
                    <p className="v2-prewrap">{t.body}</p>
                    {t.mediaUrl && <MediaPreview url={t.mediaUrl} type={t.mediaType} filename={t.mediaFilename} />}
                    {canWrite && (
                      <button
                        disabled={busy}
                        onClick={() => setEditingTemplate(t)}
                      >
                        Edit template
                      </button>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "Billing" && (
            <section className="v2-card">
              <h2>Your plan</h2>
              <h3>
                {displayStatus(subscription.planCode || "Loading")} plan ·{" "}
                {displayStatus(subscription.status)}
              </h3>
              {subscription.status === "trialing" && subscription.trialEndsAt && (
                <p className="v2-notice">Your free trial ends {new Date(subscription.trialEndsAt).toLocaleString()}.</p>
              )}
              {subscription.status === "expired" && (
                <p className="v2-error" role="alert">Your free trial has ended. Choose a paid plan to continue sending.</p>
              )}
              <div className="v2-form-grid">
                {[
                  ["WhatsApp accounts", subscription.whatsappSessionLimit],
                  ["Team members", subscription.teamMemberLimit],
                  ["Contacts", subscription.contactLimit],
                  ["Messages per month", subscription.monthlyMessageLimit],
                ].map(([k, v]) => (
                  <p key={k as string}>
                    {k}:{" "}
                    <strong>
                      {data.subscription == null
                        ? "Unavailable"
                        : v == null
                          ? "No fixed cap"
                          : count(v).toLocaleString()}
                    </strong>
                  </p>
                ))}
              </div>
              <p>{count(usage.messagesSent)} messages sent this month.</p>
              <p className="v2-muted">
                Paid checkout will appear here after the test payment provider is selected and configured.
              </p>
            </section>
          )}
          {page === "Team" && (
            <section className="v2-card">
              <h2>Team access</h2>
              <p>
                {bootstrap.user?.fullName || bootstrap.user?.email} ·{" "}
                {displayStatus(workspace?.role)}
              </p>
              <p className="v2-muted">
                To invite a colleague or change their access, contact EightBit
                support.
              </p>
            </section>
          )}
          {page === "Settings" && (
            <div className="v2-grid">
              <section className="v2-card">
                <h2>Profile</h2>
                <form
                  key={bootstrap.user?.fullName}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void perform(async () => {
                      await action("profileUpdate", undefined, {
                        fullName: f.get("fullName"),
                      });
                      await loadBootstrap();
                    });
                  }}
                >
                  <label className="v2-field">
                    Full name
                    <input
                      name="fullName"
                      defaultValue={bootstrap.user?.fullName || ""}
                      maxLength={200}
                    />
                  </label>
                  <p>{bootstrap.user?.email}</p>
                  <button className="v2-primary" disabled={busy}>
                    Save profile
                  </button>
                </form>
              </section>
              <section className="v2-card">
                <h2>Company</h2>
                <form
                  key={workspaceId + workspace?.companyName}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void perform(async () => {
                      await action("workspaceUpdate", workspaceId, {
                        companyName: f.get("companyName"),
                        timezone: f.get("timezone"),
                      });
                      await loadBootstrap();
                    });
                  }}
                >
                  <label className="v2-field">
                    Company name
                    <input
                      name="companyName"
                      defaultValue={workspace?.companyName}
                      required
                      disabled={!canManage}
                    />
                  </label>
                  <label className="v2-field">
                    Timezone
                    <select
                      name="timezone"
                      defaultValue={workspace?.timezone || config.timezone}
                      required
                      disabled={!canManage}
                    >
                      {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}
                    </select>
                  </label>
                  {canManage && (
                    <button className="v2-primary" disabled={busy}>
                      Save company
                    </button>
                  )}
                </form>
              </section>
              <section className="v2-card">
                <h2>Security</h2>
                <form
                  key={workspaceId}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    void perform(async () => {
                      if (f.get("password") !== f.get("confirmPassword"))
                        throw new Error("Passwords do not match.");
                      const { error } = await supabase!.auth.updateUser({
                        password: String(f.get("password")),
                      });
                      if (error) throw error;
                      form.reset();
                    });
                  }}
                >
                  <label className="v2-field">
                    New password
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="v2-field">
                    Confirm password
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </label>
                  <button className="v2-primary" disabled={busy}>
                    Change password
                  </button>
                </form>
              </section>
              <section className="v2-card">
                <h2>Workspace</h2>
                <p>Manage your numbers, team and subscription.</p>
                <div className="v2-actions">
                  {(["WhatsApp Accounts", "Team", "Billing"] as Page[]).map(
                    (p) => (
                      <button key={p} onClick={() => navigate(p)}>
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
      {wizard && (
        <CampaignForm
          key={workspaceId + (testSession?.whatsappSessionId || "new")}
          workspaceId={workspaceId}
          sessions={sessions}
          templates={templates}
          onCreate={create}
          onClose={() => {
            setWizard(false);
            setTestSession(null);
          }}
          testSession={testSession}
        />
      )}
    </div>
  );
}
function Auth({
  onSignedIn,
  hasSession,
}: {
  onSignedIn: () => void;
  hasSession: boolean;
}) {
  const [mode, setMode] = useState(
      location.pathname.includes("forgot-password")
        ? "forgot"
        : location.pathname.includes("reset-password")
          ? "reset"
          : location.pathname.includes("signup")
            ? "signup"
            : "login",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [fullName, setFullName] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(
      new URLSearchParams(location.search).has("error")
        ? "Sign-in was cancelled or could not be completed. Please try again."
        : "",
    );
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleSignIn = async () => {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    setNotice("");
    try {
      await continueWithGoogle();
    } catch {
      setNotice("Google sign-in is unavailable right now. Please use your email or try again later.");
      setGoogleBusy(false);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || googleBusy || !supabase) return;
    setBusy(true);
    setNotice("");
    try {
      if (["signup", "reset"].includes(mode) && password !== confirmPassword)
        throw new Error("Passwords do not match.");
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: config.appUrl + "/login",
          },
        });
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");
        if (data.session) {
          onSignedIn();
          return;
        }
        setNotice("Check your email to verify your account, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: config.appUrl + "/reset-password",
        });
        if (error) throw error;
        setNotice("If this email has an account, a reset link is on its way.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");
        onSignedIn();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setPassword("");
        onSignedIn();
      }
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const switchMode = (next: string) => {
    setMode(next);
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    history.replaceState(
      null,
      "",
      next === "forgot"
        ? "/forgot-password"
        : next === "signup"
          ? "/signup"
          : "/login",
    );
  };
  return (
    <div className="v2-auth">
      <main className="v2-auth-layout">
      <section className="v2-auth-intro">
        <EightbitLogo size="lg" />
        <p className="v2-auth-eyebrow">WHATSAPP OUTREACH</p>
        <h1>
          Your outreach.
          <br />
          One workspace.
        </h1>
        <p>
          Organize contacts, send campaigns and manage conversations from one
          workspace.
        </p>
        <ol className="v2-auth-steps">
          <li><span>1</span><div><strong>Make it your workspace</strong><p>Keep your contacts, campaigns and team together.</p></div></li>
          <li><span>2</span><div><strong>Connect your WhatsApp</strong><p>Add your company’s numbers with a guided setup.</p></div></li>
          <li><span>3</span><div><strong>Start better conversations</strong><p>Follow delivery and manage replies in one place.</p></div></li>
        </ol>
      </section>
      <section className="v2-card v2-auth-form">
        <h2>
          {mode === "signup"
            ? "Create your account"
            : mode === "forgot"
              ? "Reset your password"
              : mode === "reset"
                ? "Choose a new password"
                : "Welcome back"}
        </h2>
        <p className="v2-auth-subtitle">
          {mode === "signup" ? "Set up your account and bring your outreach together."
            : mode === "login" ? "Sign in to your company workspace."
            : mode === "forgot" ? "We’ll email you a link to get back into your account."
            : "Choose a strong password to secure your account."}
        </p>
        {["login", "signup"].includes(mode) && <>
          <button type="button" className="v2-google" onClick={googleSignIn} disabled={busy || googleBusy}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.97-3.38.97-2.61 0-4.83-1.76-5.62-4.12H3.03v2.59A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M6.38 13.93A6 6 0 0 1 6.06 12c0-.67.12-1.32.32-1.93V7.48H3.03A10 10 0 0 0 2 12c0 1.61.38 3.14 1.03 4.52l3.35-2.59Z"/>
              <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.97 5.48l3.35 2.59C7.17 7.71 9.39 5.95 12 5.95Z"/>
            </svg>
            {googleBusy ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <div className="v2-auth-divider"><span>or continue with email</span></div>
        </>}
        {googleBusy && <p className="v2-google-guidance v2-welcome-line" role="status">Taking you to Google. Choose your account to continue.</p>}
        {mode === "reset" && !hasSession ? (
          <p className="v2-notice" role="status">
            Open the password reset link from your email. If it has expired,
            request a new link below.
          </p>
        ) : (
          <form onSubmit={submit}>
            {mode === "signup" && (
              <Field
                name="Full name"
                value={fullName}
                onChange={setFullName}
                required
              />
            )}
            {mode !== "reset" && (
              <Field
                name="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                required
              />
            )}
            {mode !== "forgot" && (
              <Field
                name="Password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? undefined : 8}
                value={password}
                onChange={setPassword}
                required
              />
            )}
            {["signup", "reset"].includes(mode) && (
              <Field
                name="Confirm password"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
              />
            )}
            {notice && (
              <p role="status" className="v2-notice">
                {notice}
              </p>
            )}
            <button className="v2-primary" disabled={busy || googleBusy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Save password"
                      : "Sign in"}
            </button>
          </form>
        )}
        <div className="v2-actions">
          <button
            disabled={busy || googleBusy}
            onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button
            disabled={busy || googleBusy}
            onClick={() => switchMode(mode === "forgot" ? "login" : "forgot")}
          >
            {mode === "forgot"
              ? "Back to sign in"
              : mode === "reset"
                ? "Request a new reset link"
                : "Forgot password?"}
          </button>
        </div>
      </section>
      </main>
      <footer className="v2-auth-footer">EightBit Solutions <span aria-hidden="true">·</span> WhatsApp Outreach</footer>
    </div>
  );
}
export function Company({ onCreated, fullName = "" }: { onCreated: (id: string) => void; fullName?: string }) {
  const [companyName, setCompanyName] = useState(""),
    [timezone, setTimezone] = useState(config.timezone),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [detailStage, setDetailStage] = useState<"company" | "timezone" | "next">("company");
  const guidance = busy ? "Creating your company workspace…"
    : detailStage === "timezone" ? "Now choose your time zone. Your campaign sending windows use this setting."
    : detailStage === "next" ? "Your WhatsApp connection comes next. You can finish that step whenever you’re ready."
    : "Start with your company name. This is how your team will recognize the workspace.";
  return (
    <div className="v2-onboarding v2-company-onboarding">
      <EightbitLogo />
      <header className="v2-welcome">
        <p className="v2-eyebrow v2-welcome-line">WELCOME TO EIGHTBIT OUTREACH</p>
        <h1 className="v2-welcome-line">{fullName.trim() ? `Welcome, ${fullName.trim().split(/\s+/)[0]}.` : "Your outreach starts here."}</h1>
        <p className="v2-welcome-line">Let’s make this workspace yours.</p>
      </header>
      <section className="v2-card">
        <p className="v2-company-step"><span aria-hidden="true">01</span> Company details <span className="v2-muted">Step 1 of 4</span></p>
        <h2>Set up your company</h2>
        <p>
          Your numbers, campaigns and contacts stay together in this workspace.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const data = await action("workspaceCreate", undefined, {
                companyName,
                timezone,
              });
              onCreated(data.workspaceId);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div onBlur={() => { if (companyName.trim()) setDetailStage("timezone"); }}>
          <Field
            name="Company name"
            value={companyName}
            onChange={(value) => { setCompanyName(value); if (!value.trim()) setDetailStage("company"); }}
            required
          />
          </div>
          <div onBlur={() => { if (companyName.trim() && timezone.trim()) setDetailStage("next"); }}>
          <Field
            name="Timezone"
            value={timezone}
            onChange={(value) => { setTimezone(value); if (!value.trim()) setDetailStage(companyName.trim() ? "timezone" : "company"); }}
            options={TIME_ZONES.map((zone) => ({ value: zone, label: timeZoneLabel(zone) }))}
            required
          />
          </div>
          <p key={busy ? "saving" : detailStage} className="v2-onboarding-guidance v2-welcome-line" role="status" aria-live="polite" aria-atomic="true">{guidance}</p>
          {error && <p role="alert">{error}</p>}
          <button className="v2-primary" disabled={busy}>
            {busy ? "Creating…" : "Continue to WhatsApp"}
          </button>
        </form>
      </section>
    </div>
  );
}
export function Connections({
  workspaceId,
  sessions,
  onRefresh,
  canManage,
  onTest,
}: {
  workspaceId: string;
  sessions: Row[];
  onRefresh: () => Promise<void>;
  canManage: boolean;
  onTest: (session: Row) => void;
}) {
  const [automatic, setAutomatic] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const openAutomatic = () => { setError(""); setAutomatic(true); };
  useDialogFocus(automatic, () => {}, busy);
  const operate = async (op: string, s: Row) => {
    if (busy) return;
    if (
      ["sessionDisconnect", "sessionDelete"].includes(op) &&
      !confirm(
        (op === "sessionDelete"
          ? "Remove this connection from EightBit?"
          : "Disconnect this number from EightBit?") +
          " History is retained; WASender remains signed in.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await action(op, workspaceId, { whatsappSessionId: s.whatsappSessionId });
      await onRefresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="v2-section-head">
        <div>
          <h2>Your WhatsApp connections</h2>
          <p>Add a number for each sales team, branch or service.</p>
        </div>
        {canManage && (
          <button
            className="v2-primary"
            onClick={openAutomatic}
          >
            <Plus size={15} /> Add WhatsApp Account
          </button>
        )}
      </div>
      {error && (
        <p className="v2-error" role="alert">
          {error}
        </p>
      )}
      {automatic && <div className="v2-overlay"><section className="v2-dialog" role="dialog" aria-modal="true" aria-label="Connect WhatsApp"><AutomaticConnection key={workspaceId} workspaceId={workspaceId} onRefresh={onRefresh} onClose={() => setAutomatic(false)} /></section></div>}
      <div className="v2-grid">
        {sessions.map((s) => (
          <article className="v2-card" key={s.whatsappSessionId}>
            <div className="v2-section-head">
              <Smartphone size={24} />
              <span
                className={"v2-status " + (s.configured ? s.status : "pending")}
              >
                {s.configured ? displayStatus(s.status) : "Setup required"}
              </span>
            </div>
            <h3>{s.displayName}</h3>
            <p>{s.phoneE164 || "Number not linked yet"}</p>
            <p className="v2-muted">
              {s.configured
                ? s.webhookReady
                  ? "Message updates connected"
                  : "Message updates awaiting verification"
                : "Setup needed"}
            </p>
            {s.providerMode === "legacy_n8n" && (
              <p className="v2-notice">
                Previous connection. Add a new WhatsApp account when your
                earlier campaigns have finished.
              </p>
            )}
            <div className="v2-actions">
              {s.configured && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void operate("sessionStatus", s)}
                  >
                    Check status
                  </button>
                </>
              )}
              {canManage && s.configured && (
                <button
                  disabled={busy || s.status !== "connected"}
                  onClick={() => onTest(s)}
                >
                  Test connection
                </button>
              )}
              {canManage &&
                !s.configured &&
                s.providerMode === "manual_session_key" && (
                  <button
                    onClick={openAutomatic}
                  >
                    Continue setup
                  </button>
                )}
              {canManage &&
                !s.configured &&
                s.providerMode === "manual_session_key" && (
                  <button
                    disabled={busy}
                    onClick={() => void operate("sessionDelete", s)}
                  >
                    Remove connection
                  </button>
                )}
              {canManage && s.configured && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void operate("sessionDisconnect", s)}
                  >
                    Disconnect from EightBit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void operate("sessionDelete", s)}
                  >
                    Remove connection
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {!sessions.length && (
        <section className="v2-card">
          <h3>Connect your first number</h3>
          <p>
            Connect WhatsApp in your WASender account, then use your Personal Access
            Token to select a number. We configure message updates automatically.
          </p>
        </section>
      )}
    </>
  );
}
