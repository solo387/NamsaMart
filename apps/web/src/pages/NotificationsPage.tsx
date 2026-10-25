import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellRing, CheckCheck, CircleDot, Mail, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import type { NotificationItem } from "../lib/types";
import { Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/ui";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>("/notifications");
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Notifications could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function toggleRead(item: NotificationItem) {
    try {
      const isRead = !item.isRead;
      await api.patch(`/notifications/${item.id}/read`, { isRead });
      setNotifications((items) => items.map((notification) => notification.id === item.id ? { ...notification, isRead } : notification));
      setUnreadCount((count) => Math.max(0, count + (isRead ? -1 : 1)));
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Read state could not be updated."));
    }
  }

  async function markAll() {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Notifications could not be updated."));
    }
  }

  return <div><PageHeading eyebrow="Stay up to date" title="Notifications" description="Important learning updates, class reminders, and department news." action={unreadCount > 0 ? <Button variant="secondary" onClick={() => void markAll()}><CheckCheck size={16} />Mark all read</Button> : undefined} />
    <div className="mb-5 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3 text-sm dark:bg-teal-950/50"><span className="inline-flex items-center gap-2 font-semibold text-teal-900 dark:text-teal-100"><BellRing size={17} />{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}</span><Link to="/profile" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline dark:text-teal-200"><Settings2 size={14} />Preferences</Link></div>
    {loading ? <Loading label="Loading your notifications…" /> : error ? <ErrorNotice message={error} retry={() => void load()} /> : notifications.length ? <div className="space-y-2">{notifications.map((item) => <Card key={item.id} className={`flex items-start gap-3 p-4 ${!item.isRead ? "border-teal-100 bg-teal-50/30 dark:border-teal-950 dark:bg-teal-950/20" : ""}`}><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.isRead ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100"}`}><Bell size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{item.type.replaceAll("_", " ")}</span>{!item.isRead && <CircleDot size={11} className="text-teal-600" />}</div><p className="mt-1 text-sm font-semibold">{item.message}</p><p className="mt-1 text-xs text-slate-500">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p></div><div className="flex shrink-0 items-center gap-1">{item.link && <Link to={item.link} aria-label={`Open: ${item.message}`} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-slate-800">Open</Link>}<button onClick={() => void toggleRead(item)} aria-label={item.isRead ? "Mark unread" : "Mark read"} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">{item.isRead ? <Mail size={16} /> : <CheckCheck size={16} />}</button></div></Card>)}</div> : <EmptyState title="No notifications yet" description="You'll see updates here when a new class, quiz, or announcement is shared." icon={Bell} />}
  </div>;
}
