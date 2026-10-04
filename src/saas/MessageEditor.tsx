import { useEffect, useRef, useState } from "react";

const fields = [
  ["first_name", "First name"], ["company", "Company"], ["name", "Full name"],
  ["phone", "Phone"], ["email", "Email"], ["city", "City"], ["industry", "Industry"],
];
const examples = [
  { name: "Khurram Ahmed", first_name: "Khurram", company: "ITB Solutions", phone: "+12025550101", email: "khurram@example.com", city: "Karachi", industry: "Technology" },
  { name: "Ali Khan", first_name: "Ali", company: "Sysnova Solutions", phone: "+12025550102", email: "ali@example.com", city: "Lahore", industry: "Technology" },
];
export function MessageEditor({ value, defaultValue = "", onChange, name }: { value?: string; defaultValue?: string; onChange?: (value: string) => void; name?: string }) {
  const [local, setLocal] = useState(defaultValue);
  const [sample, setSample] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => { if (value === undefined) setLocal(defaultValue); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, value]);
  const text = value ?? local;
  const change = (next: string) => { setLocal(next); onChange?.(next); };
  const insert = (key: string) => {
    const input = ref.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const token = "{{" + key + "}}";
    if (text.length - (end - start) + token.length > 4096) return;
    change(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); });
  };
  const preview = text.replace(/\{\{([a-z_]+)\}\}/g, (token, key) => (examples[sample] as Record<string, string>)[key] ?? token);
  return <div className="v2-message-editor">
    <label className="v2-field">Message<textarea ref={ref} name={name} value={text} onChange={e => change(e.target.value)} required maxLength={4096} rows={5} placeholder="Hi {{first_name}}, I saw your company, {{company}}…" /></label>
    <p className="v2-muted">Personalize your message. Click a field to insert it where you’re typing.</p>
    <div className="v2-actions" aria-label="Insert a contact field">{fields.map(([key, title]) => <button type="button" key={key} onClick={() => insert(key)}>+ {title}</button>)}</div>
    <p className="v2-muted">Each lead’s spreadsheet supplies these values. Use columns such as first_name and company. Missing values become blank; check your leads before starting.</p>
    <section className="v2-message-preview" aria-label="Example message preview">
      <label className="v2-field">Example preview<select value={sample} onChange={e => setSample(Number(e.target.value))}>{examples.map((contact, index) => <option key={contact.name} value={index}>{contact.first_name} · {contact.company}</option>)}</select></label>
      <p className="v2-prewrap">{preview || "Your personalized message will appear here."}</p>
      <small className="v2-muted">Illustrative contacts only. Actual messages use your imported lead data.</small>
    </section>
  </div>;
}
