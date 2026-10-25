import { useEffect, useState, type FormEvent } from "react";
import { Bell, Camera, KeyRound, LogOut, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { api, getErrorMessage } from "../lib/api";
import { Button, Card, Field, Input, PageHeading } from "../components/ui";

interface Preferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export function ProfilePage() {
  const { user, refreshUser, signOut } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>({ emailEnabled: true, pushEnabled: true });
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);

  useEffect(() => {
    void api.get<{ preference: Preferences }>("/notifications/preferences")
      .then((result) => setPreferences(result.data.preference))
      .catch((cause) => toast.error(getErrorMessage(cause, "Notification preferences could not load.")));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileBusy(true);
    try {
      await api.patch("/auth/profile", {
        name: form.get("name")
      });
      await refreshUser();
      toast.success("Your profile has been updated.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Profile could not be updated."));
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== form.get("confirmPassword")) {
      toast.error("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: form.get("currentPassword"), newPassword });
      formElement.reset();
      toast.success("Password updated.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Password could not be changed."));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post("/media/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
      await refreshUser();
      toast.success("Profile photo updated.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Profile photo could not be uploaded."));
    }
  }

  async function savePreference(key: keyof Preferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setPreferenceBusy(true);
    try {
      await api.patch("/notifications/preferences", { [key]: value });
      toast.success("Notification preference saved.");
    } catch (cause) {
      setPreferences(preferences);
      toast.error(getErrorMessage(cause, "Notification preference could not be saved."));
    } finally {
      setPreferenceBusy(false);
    }
  }

  return <div><PageHeading eyebrow="Your account" title="Profile & settings" description="Manage your account details and choose how NamsaMart reaches you." />
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <div className="space-y-5">
        <Card><div className="mb-5 flex items-center gap-2"><UserRound size={18} className="text-teal-700" /><h2 className="text-lg font-bold">Profile details</h2></div><div className="mb-5 flex items-center gap-4"><div className="relative">{user?.avatarUrl ? <img src={user.avatarUrl} alt={`${user.name} profile`} className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-teal-100 text-lg font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-100">{user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>}<label className="absolute -bottom-2 -right-2 grid h-8 w-8 cursor-pointer place-items-center rounded-xl border-2 border-white bg-teal-700 text-white shadow-sm hover:bg-teal-800 dark:border-slate-900" aria-label="Upload profile photo"><Camera size={14} /><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose a JPG, PNG, or WebP profile photo" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></label></div><div><p className="font-bold">{user?.name}</p><p className="mt-0.5 text-xs text-slate-500">{user?.email}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{user?.role}</p></div></div>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><Input name="name" defaultValue={user?.name} required minLength={2} maxLength={100} /></Field><Field label="Email address"><Input value={user?.email ?? ""} disabled readOnly /></Field><Field label="Department"><Input value={user?.department.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? ""} disabled readOnly /></Field><Field label="Level / year"><Input value={user?.level ?? ""} disabled readOnly /></Field><p className="text-xs text-slate-500 sm:col-span-2">Department and study level are verified by an administrator and cannot be changed from your profile.</p><Button type="submit" disabled={profileBusy} className="sm:col-span-2 sm:justify-self-end"><Save size={16} />{profileBusy ? "Saving…" : "Save profile"}</Button></form>
        </Card>
        <Card><div className="mb-5 flex items-center gap-2"><KeyRound size={18} className="text-teal-700" /><h2 className="text-lg font-bold">Change password</h2></div><form onSubmit={changePassword} className="grid gap-4"><Field label="Current password"><Input name="currentPassword" type="password" autoComplete="current-password" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="New password" hint="At least 10 characters."><Input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></Field><Field label="Confirm new password"><Input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></Field></div><Button type="submit" disabled={passwordBusy} className="sm:justify-self-end">{passwordBusy ? "Updating…" : "Update password"}</Button></form></Card>
      </div>
      <div className="space-y-5">
        <Card><div className="mb-5 flex items-center gap-2"><Bell size={18} className="text-teal-700" /><h2 className="text-lg font-bold">Notification preferences</h2></div><p className="mb-4 text-sm text-slate-500">Choose how you would like to receive learning updates. In-app notifications remain available in your notification centre.</p><div className="space-y-3">{([{ key: "pushEnabled", title: "In-app notifications", detail: "Class reminders, new resources, and announcements" }, { key: "emailEnabled", title: "Email updates", detail: "Important updates sent to your account email" }] as const).map(({ key, title, detail }) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70"><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span><input type="checkbox" checked={preferences[key]} disabled={preferenceBusy} onChange={(event) => void savePreference(key, event.target.checked)} className="h-5 w-5 accent-teal-700" /></label>)}</div><p className="mt-3 text-[11px] text-slate-400">Push notifications require permission from your browser or installed app.</p></Card>
        <Card className="border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-teal-700 dark:bg-slate-800"><ShieldCheck size={17} /></span><div><h2 className="text-sm font-bold">Account security</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Your role is managed by your department administrator. Contact them if your access needs to change.</p></div></div></Card>
        <Button variant="danger" className="w-full" onClick={() => { signOut(); window.location.href = "/login"; }}><LogOut size={17} />Sign out of NamsaMart</Button>
      </div>
    </div>
  </div>;
}
