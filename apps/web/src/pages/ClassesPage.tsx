import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { io, type Socket } from "socket.io-client";
import { CalendarPlus, CalendarRange, Clock3, MessageCircle, Mic, Radio, Send, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { api, getErrorMessage } from "../lib/api";
import { socketUrl } from "../lib/runtime-config";
import type { ClassSession, Course } from "../lib/types";
import { Button, Card, EmptyState, ErrorNotice, Field, Input, Loading, PageHeading } from "../components/ui";

interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
}

export function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassSession | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [classResult, courseResult] = await Promise.all([
        api.get<{ classes: ClassSession[] }>("/classes"),
        api.get<{ courses: Course[] }>("/courses")
      ]);
      setClasses(classResult.data.classes);
      setCourses(courseResult.data.courses);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Class schedule could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await api.post("/classes", {
        title: form.get("title"),
        courseId: form.get("courseId"),
        scheduledAt: new Date(String(form.get("scheduledAt"))).toISOString()
      });
      toast.success("Class added to the schedule.");
      setShowSchedule(false);
      formElement.reset();
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Class could not be scheduled."));
    } finally {
      setBusy(false);
    }
  }

  async function startClass(session: ClassSession) {
    setBusy(true);
    try {
      const result = await api.post<{ meetingUrl: string }>(`/classes/${session.id}/start`);
      setActiveClass(session);
      setMeetingUrl(result.data.meetingUrl);
      setClasses((items) => items.map((item) => item.id === session.id ? { ...item, isLive: true } : item));
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Class could not be started."));
    } finally {
      setBusy(false);
    }
  }

  async function joinClass(session: ClassSession) {
    setBusy(true);
    try {
      const result = await api.post<{ meetingUrl: string }>(`/classes/${session.id}/join`);
      setActiveClass(session);
      setMeetingUrl(result.data.meetingUrl);
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Class could not be joined."));
    } finally {
      setBusy(false);
    }
  }

  async function endClass() {
    if (!activeClass) return;
    const recordingUrl = window.prompt("If you recorded outside Daily, paste its hosted URL. Otherwise leave this blank; the Daily cloud recording will be saved automatically.");
    if (recordingUrl === null) return;
    setBusy(true);
    try {
      await api.patch(`/classes/${activeClass.id}/end`, { recordingUrl: recordingUrl || undefined });
      setActiveClass(null);
      setMeetingUrl("");
      toast.success("Class ended.");
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Class could not be ended."));
    } finally {
      setBusy(false);
    }
  }

  const canHost = user?.role === "LECTURER" || user?.role === "ADMIN";
  const upcoming = classes.filter((item) => item.isLive || new Date(item.scheduledAt) >= new Date());
  const past = classes.filter((item) => !item.isLive && new Date(item.scheduledAt) < new Date());

  return <div>
    <PageHeading eyebrow="Learn together" title="Online classes" description="Join live teaching sessions, follow your course schedule, and revisit class recordings." action={canHost ? <Button onClick={() => setShowSchedule(!showSchedule)}><CalendarPlus size={17} />{showSchedule ? "Close" : "Schedule class"}</Button> : undefined} />
    {showSchedule && canHost && <Card className="mb-6 border-teal-100 bg-teal-50/30 dark:border-teal-950 dark:bg-teal-950/20"><form onSubmit={schedule} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_auto] lg:items-end"><div className="sm:col-span-2 lg:col-span-4"><h2 className="font-bold">Add a teaching session</h2><p className="mt-1 text-xs text-slate-500">A secure Daily.co room is created when the lecturer starts the class.</p></div><Field label="Class title"><Input name="title" required minLength={3} maxLength={160} placeholder="e.g. Antenatal assessment workshop" /></Field><Field label="Course"><select name="courseId" required defaultValue="" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></Field><Field label="Date and time"><Input name="scheduledAt" type="datetime-local" required min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} /></Field><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add to schedule"}</Button></form></Card>}
    {loading ? <Loading label="Loading your class schedule…" /> : error ? <ErrorNotice message={error} retry={() => void load()} /> : <>
      {activeClass && <LiveClassPanel session={activeClass} meetingUrl={meetingUrl} onClose={() => { setActiveClass(null); setMeetingUrl(""); }} canHost={canHost && activeClass.host.id === user?.id} busy={busy} onEnd={() => void endClass()} />}
      <section className="mb-8"><div className="mb-3 flex items-center gap-2"><CalendarRange size={18} className="text-teal-700" /><h2 className="text-lg font-bold">Upcoming sessions</h2></div>{upcoming.length ? <div className="grid gap-4 lg:grid-cols-2">{upcoming.map((session) => <Card key={session.id} className="flex flex-col"><div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"><Video size={21} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{session.course.code}</p><h3 className="mt-1 text-lg font-bold">{session.title}</h3><p className="mt-1 text-sm text-slate-500">{session.course.title}</p></div>{session.isLive && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase text-rose-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />Live</span>}</div><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 size={15} />{format(new Date(session.scheduledAt), "EEEE, MMMM d · h:mm a")}<span className="ml-auto">Host: {session.host.name}</span></div><div className="mt-4 flex gap-2">{canHost && session.host.id === user?.id && <Button variant="secondary" className="flex-1" onClick={() => void startClass(session)} disabled={busy || session.isLive}>{session.isLive ? "Room is live" : "Start class"}</Button>}{session.isLive && <Button className="flex-1" onClick={() => void joinClass(session)} disabled={busy}>Join live class</Button>}</div></Card>)}</div> : <EmptyState title="No upcoming classes" description="Scheduled classes for your courses will appear here." icon={CalendarRange} />}</section>
      {past.length > 0 && <section><div className="mb-3 flex items-center gap-2"><Clock3 size={18} className="text-slate-500" /><h2 className="text-lg font-bold">Past sessions & recordings</h2></div><div className="grid gap-3">{past.map((session) => <Card key={session.id} className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{session.title}</p><p className="mt-1 text-xs text-slate-500">{session.course.code} · {format(new Date(session.scheduledAt), "MMM d, yyyy · h:mm a")}</p></div><RecordingLink session={session} /></Card>)}</div></section>}
    </>}
  </div>;
}

function RecordingLink({ session }: { session: ClassSession }) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRecording() {
    setLoading(true);
    try {
      const result = await api.get<{ recordingUrl: string }>(`/classes/${session.id}/recording`);
      setRecordingUrl(result.data.recordingUrl);
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Recording is not ready yet."));
    } finally {
      setLoading(false);
    }
  }

  const url = session.recordingUrl || recordingUrl;
  if (!session.recordingUrl && !session.roomUrl) {
    return <span className="text-xs text-slate-400">No recording available</span>;
  }

  return <div className="flex flex-wrap items-center gap-2">
    {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50"><Video size={15} />Download recording</a>}
    {!session.recordingUrl && <Button variant="secondary" size="sm" onClick={() => void loadRecording()} disabled={loading}>
      {loading ? "Preparing link…" : recordingUrl ? "Refresh link" : "Get recording"}
    </Button>}
  </div>;
}

function LiveClassPanel({ session, meetingUrl, onClose, canHost, busy, onEnd }: { session: ClassSession; meetingUrl: string; onClose: () => void; canHost: boolean; busy: boolean; onEnd: () => void }) {
  return <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800" aria-label="Live class room"><div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white"><div className="min-w-0"><p className="truncate text-sm font-bold">{session.title}</p><p className="text-xs text-slate-400">{session.course.code} · Daily.co classroom</p></div><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-bold uppercase text-rose-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />Live</span>{canHost ? <Button variant="danger" size="sm" onClick={onEnd} disabled={busy}>{busy ? "Ending…" : "End class"}</Button> : <button aria-label="Leave classroom" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-white/10"><X size={18} /></button>}</div></div><div className="grid lg:grid-cols-[1fr_300px]"><iframe src={meetingUrl} title={`Live class: ${session.title}`} allow="camera; microphone; fullscreen; display-capture; autoplay" className="aspect-video w-full bg-black lg:min-h-[460px]" /><ClassChat classId={session.id} /></div></section>;
}

function ClassChat({ classId }: { classId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api.get<{ messages: ChatMessage[] }>(`/classes/${classId}/messages`).then((result) => {
      if (active) setMessages(result.data.messages);
    }).catch((cause) => { if (active) setError(getErrorMessage(cause, "Chat history could not load.")); });
    const token = localStorage.getItem("namsamart-token");
    if (!token) return;
    const connection = io(socketUrl, { auth: { token } });
    connection.emit("class:join", classId, (result: { error?: string }) => { if (result.error) setError(result.error); });
    connection.on("class:message", (message: ChatMessage) => setMessages((items) => [...items, message]));
    setSocket(connection);
    return () => { active = false; connection.disconnect(); };
  }, [classId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      await api.post(`/classes/${classId}/messages`, { body: body.trim() });
      setBody("");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Message could not be sent."));
    }
  }

  return <aside className="flex min-h-[340px] flex-col border-t border-slate-800 bg-slate-900 text-white lg:border-l lg:border-t-0"><div className="flex items-center gap-2 border-b border-white/10 p-3.5"><MessageCircle size={16} className="text-teal-300" /><span className="text-sm font-semibold">Class chat</span><span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{messages.length}</span></div><div className="flex-1 space-y-3 overflow-y-auto p-3.5" aria-live="polite">{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}{messages.length ? messages.map((message) => <div key={message.id} className="text-xs"><p className="mb-1 flex items-center justify-between gap-2"><span className={`font-semibold ${message.user.id === user?.id ? "text-teal-300" : "text-slate-300"}`}>{message.user.id === user?.id ? "You" : message.user.name}</span><span className="text-[10px] text-slate-500">{format(new Date(message.createdAt), "h:mm a")}</span></p><p className="break-words rounded-xl bg-white/5 px-3 py-2 leading-relaxed text-slate-100">{message.body}</p></div>) : !error && <p className="py-10 text-center text-xs leading-relaxed text-slate-500">Be the first to say hello to your classmates.</p>}</div><form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3"><label className="sr-only" htmlFor="class-chat-message">Write a message</label><input id="class-chat-message" maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Message your class…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs outline-none focus:border-teal-500" /><button disabled={!body.trim() || !socket?.connected} aria-label="Send chat message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"><Send size={16} /></button></form><div className="px-3 pb-3 text-[10px] text-slate-500"><Mic size={11} className="mr-1 inline" />Class audio and video are provided securely by Daily.co.</div></aside>;
}
