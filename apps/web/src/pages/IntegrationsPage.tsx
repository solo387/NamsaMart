import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, KeyRound, Mail, Radio, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { Button, Card, ErrorNotice, Field, Input, Loading, PageHeading, Select } from "../components/ui";

type IntegrationName = "daily" | "cloudinary" | "smtp";
type IntegrationStatus = { configured: boolean; source: "app" | "environment" | "missing" };
type IntegrationStatuses = Record<IntegrationName, IntegrationStatus>;
type IntegrationResponse = { encryptionAvailable: boolean; integrations: IntegrationStatuses };

const initialStatuses: IntegrationStatuses = {
  daily: { configured: false, source: "missing" },
  cloudinary: { configured: false, source: "missing" },
  smtp: { configured: false, source: "missing" }
};

export function IntegrationsPage() {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<IntegrationName | null>(null);

  async function load() {
    setLoading(true);
    try {
      const result = await api.get<IntegrationResponse>("/admin/integrations");
      setStatuses(result.data.integrations);
      setEncryptionAvailable(result.data.encryptionAvailable);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Integration settings could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>, provider: IntegrationName) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values: Record<string, string | boolean | number> = {};
    for (const [key, value] of form.entries()) {
      if (value instanceof File) continue;
      if (typeof value !== "string" || value.trim() === "") continue;
      values[key] = key === "port" ? Number(value) : key === "secure" ? value === "true" : value;
    }
    if (Object.keys(values).length === 0) {
      toast.info("Enter at least one setting to save.");
      return;
    }
    setBusy(provider);
    try {
      const result = await api.put<IntegrationResponse>(`/admin/integrations/${provider}`, values);
      setStatuses(result.data.integrations);
      setEncryptionAvailable(result.data.encryptionAvailable);
      formElement.reset();
      toast.success(`${providerLabel(provider)} settings saved securely.`);
    } catch (cause) {
      toast.error(getErrorMessage(cause, `${providerLabel(provider)} settings could not be saved.`));
    } finally {
      setBusy(null);
    }
  }

  async function test(provider: IntegrationName) {
    setBusy(provider);
    try {
      await api.post(`/admin/integrations/${provider}/test`);
      toast.success(`${providerLabel(provider)} connection verified.`);
    } catch (cause) {
      toast.error(getErrorMessage(cause, `${providerLabel(provider)} connection could not be verified.`));
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: IntegrationName) {
    setBusy(provider);
    try {
      const result = await api.delete<IntegrationResponse>(`/admin/integrations/${provider}`);
      setStatuses(result.data.integrations);
      setEncryptionAvailable(result.data.encryptionAvailable);
      toast.success(`${providerLabel(provider)} app settings removed.`);
    } catch (cause) {
      toast.error(getErrorMessage(cause, `${providerLabel(provider)} settings could not be removed.`));
    } finally {
      setBusy(null);
    }
  }

  return <div>
    <PageHeading eyebrow="Administrator controls" title="Provider integrations" description="Configure the service credentials used for learning uploads, live classes, and password reset email." />
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <ShieldCheck className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
      <p>Credentials are encrypted before storage and are never shown again after saving. {encryptionAvailable ? <>Keep a secure backup of the API host&apos;s <code>INTEGRATION_SECRETS_KEY</code>; without it saved credentials cannot be decrypted.</> : <>Ask the API host operator to configure <code>INTEGRATION_SECRETS_KEY</code> before saving credentials. Existing environment-configured providers continue to work.</>}</p>
    </div>
    {loading ? <Loading label="Loading provider integrations…" /> : error ? <ErrorNotice message={error} retry={() => void load()} /> : <div className="grid gap-5 xl:grid-cols-2">
      <IntegrationCard title="Daily.co live classes" icon={<Radio size={20} />} status={statuses.daily} busy={busy === "daily"} canSave={encryptionAvailable} onSave={(event) => void save(event, "daily")} onTest={() => void test("daily")} onRemove={() => void remove("daily")}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Enables private meeting rooms, automatic cloud recordings, and recording links.</p>
        <Field label="Daily API key" hint={savedHint(statuses.daily)}><Input name="apiKey" type="password" autoComplete="new-password" placeholder="Paste API key to add or replace" /></Field>
      </IntegrationCard>

      <IntegrationCard title="Cloudinary file storage" icon={<KeyRound size={20} />} status={statuses.cloudinary} busy={busy === "cloudinary"} canSave={encryptionAvailable} onSave={(event) => void save(event, "cloudinary")} onTest={() => void test("cloudinary")} onRemove={() => void remove("cloudinary")}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Enables lecturer learning-material uploads, past questions, and profile avatars.</p>
        <Field label="Cloud name" hint={savedHint(statuses.cloudinary)}><Input name="cloudName" autoComplete="off" placeholder="Cloudinary cloud name" /></Field>
        <Field label="API key"><Input name="apiKey" type="password" autoComplete="new-password" placeholder="Cloudinary API key" /></Field>
        <Field label="API secret"><Input name="apiSecret" type="password" autoComplete="new-password" placeholder="Cloudinary API secret" /></Field>
      </IntegrationCard>

      <IntegrationCard title="SMTP email" icon={<Mail size={20} />} status={statuses.smtp} busy={busy === "smtp"} canSave={encryptionAvailable} onSave={(event) => void save(event, "smtp")} onTest={() => void test("smtp")} onRemove={() => void remove("smtp")}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Enables password-reset emails sent from the application.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SMTP host" hint={savedHint(statuses.smtp)}><Input name="host" autoComplete="off" placeholder="smtp.example.com" /></Field>
          <Field label="SMTP port"><Input name="port" type="number" min={1} max={65535} placeholder="587" /></Field>
          <Field label="Use implicit TLS (usually port 465)"><Select name="secure" defaultValue=""><option value="" disabled>Keep current setting</option><option value="true">Yes</option><option value="false">No (STARTTLS if available)</option></Select></Field>
          <Field label="SMTP username"><Input name="user" autoComplete="off" placeholder="Email account username" /></Field>
          <Field label="SMTP password"><Input name="password" type="password" autoComplete="new-password" placeholder="Email account password" /></Field>
          <Field label="From address"><Input name="from" autoComplete="off" placeholder="NamsaMart &lt;no-reply@example.com&gt;" /></Field>
        </div>
      </IntegrationCard>
    </div>}
  </div>;
}

function IntegrationCard({ title, icon, status, busy, canSave, onSave, onTest, onRemove, children }: {
  title: string;
  icon: ReactNode;
  status: IntegrationStatus;
  busy: boolean;
  canSave: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onTest: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return <Card className="h-fit">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{icon}</span>
      <div className="min-w-0 flex-1"><h2 className="font-bold">{title}</h2><p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${status.configured ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500"}`}>
        <CheckCircle2 size={14} aria-hidden="true" />{status.configured ? `Configured via ${status.source === "app" ? "this page" : "API environment"}` : "Not configured"}
      </p></div>
    </div>
    <form onSubmit={onSave} className="grid gap-4">
      {children}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {status.configured && <Button type="button" size="sm" variant="secondary" onClick={onTest} disabled={busy}>{busy ? "Working…" : "Test connection"}</Button>}
        {status.source === "app" && <Button type="button" size="sm" variant="danger" onClick={onRemove} disabled={busy}><Trash2 size={15} />Remove saved settings</Button>}
        <Button type="submit" size="sm" disabled={busy || !canSave}>{busy ? "Working…" : "Save settings"}</Button>
      </div>
    </form>
  </Card>;
}

function savedHint(status: IntegrationStatus) {
  return status.configured ? "Leave blank to keep saved credentials; new values replace them." : undefined;
}

function providerLabel(provider: IntegrationName) {
  return provider === "daily" ? "Daily.co" : provider === "cloudinary" ? "Cloudinary" : "SMTP";
}
