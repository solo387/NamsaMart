import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight, Bell, BookOpen, BookOpenCheck, CalendarClock, CircleHelp,
  GraduationCap, HeartPulse, Newspaper, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { api, departmentLabel, getErrorMessage } from "../lib/api";
import type { ClassSession, Course, NewsPost, NotificationItem, QuizSummary, Slide } from "../lib/types";
import { Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/ui";

const quickLinks = [
  { to: "/slides", label: "Learning materials", detail: "Study guides & lecture notes", icon: BookOpen, color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { to: "/past-questions", label: "Past questions", detail: "Practice for your exams", icon: CircleHelp, color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { to: "/quizzes", label: "Quizzes", detail: "Check your understanding", icon: GraduationCap, color: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  { to: "/classes", label: "Online classes", detail: "Join your department live", icon: CalendarClock, color: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  { to: "/news", label: "News & events", detail: "Stay in the loop", icon: Newspaper, color: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" }
];

interface DashboardData {
  courses: Course[];
  slides: Slide[];
  quizzes: QuizSummary[];
  classes: ClassSession[];
  news: NewsPost[];
  notifications: NotificationItem[];
  unreadCount: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [courses, slides, quizzes, classes, news, notifications] = await Promise.all([
        api.get<{ courses: Course[] }>("/courses"),
        api.get<{ slides: Slide[] }>("/materials/slides"),
        api.get<{ quizzes: QuizSummary[] }>("/quizzes"),
        api.get<{ classes: ClassSession[] }>("/classes"),
        api.get<{ news: NewsPost[] }>("/news"),
        api.get<{ notifications: NotificationItem[]; unreadCount: number }>("/notifications")
      ]);
      setData({
        courses: courses.data.courses,
        slides: slides.data.slides.slice(0, 3),
        quizzes: quizzes.data.quizzes.slice(0, 3),
        classes: classes.data.classes,
        news: news.data.news.slice(0, 3),
        notifications: notifications.data.notifications.slice(0, 3),
        unreadCount: notifications.data.unreadCount
      });
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Your dashboard could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadDashboard(); }, []);

  if (loading) return <Loading label="Getting your learning space ready…" />;
  if (error || !data) return <ErrorNotice message={error || "Your dashboard could not load."} retry={() => void loadDashboard()} />;

  const upcoming = data.classes.filter((item) => item.isLive || new Date(item.scheduledAt) >= new Date()).slice(0, 2);
  const firstName = user?.name.split(" ")[0] ?? "Student";
  const facts = [
    { value: data.courses.length, label: "Courses this term", icon: BookOpenCheck },
    { value: data.slides.length, label: "New resources", icon: BookOpen },
    { value: data.quizzes.length, label: "Open quizzes", icon: GraduationCap },
    { value: data.unreadCount, label: "Unread updates", icon: Bell }
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#0b5d59] via-teal-800 to-emerald-900 px-6 py-7 text-white shadow-lg shadow-teal-900/10 sm:px-9 sm:py-9">
        <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="absolute right-16 top-8 h-40 w-40 rounded-full border border-white/10" />
        <div className="relative max-w-2xl"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-50"><Sparkles size={13} /> Your clinical learning journey</span><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {firstName}.</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-teal-50/80 sm:text-base">Keep building the knowledge and confidence that make compassionate care possible.</p><div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">{departmentLabel(user?.department ?? "")}</span><span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">{user?.level}</span></div></div>
        <HeartPulse className="absolute bottom-7 right-9 hidden text-white/15 sm:block" size={88} strokeWidth={1.2} />
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{facts.map(({ value, label, icon: Icon }, index) => <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"><Icon size={19} /></span><span><span className="block text-2xl font-bold leading-none">{value}</span><span className="mt-1 block text-[11px] font-medium text-slate-500 sm:text-xs">{label}</span></span></Card></motion.div>)}</section>

      <section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-400">Explore</p><h2 className="mt-1 text-xl font-bold">Your learning toolkit</h2></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{quickLinks.map(({ to, label, detail, icon: Icon, color }) => <Link key={to} to={to} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-900"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${color}`}><Icon size={22} /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span><ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-700" size={18} /></Link>)}</div></section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-400">On your schedule</p><h2 className="mt-1 text-lg font-bold">Upcoming classes</h2></div><Link to="/classes" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400">See schedule <ArrowRight size={14} /></Link></div>{upcoming.length ? <div className="space-y-3">{upcoming.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-center dark:bg-slate-900"><span className="text-[10px] font-bold uppercase text-teal-700 dark:text-teal-300">{format(new Date(item.scheduledAt), "MMM")}</span><span className="text-lg font-bold leading-5">{format(new Date(item.scheduledAt), "d")}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.course.code} · {format(new Date(item.scheduledAt), "EEEE, h:mm a")}</p></div>{item.isLive && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase text-rose-700">Live</span>}</div>)}</div> : <EmptyState title="Nothing scheduled yet" description="Your upcoming class sessions will show up here." icon={CalendarClock} />}</Card>
        <Card><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-400">From your department</p><h2 className="mt-1 text-lg font-bold">Latest updates</h2></div><Link to="/news" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400">All news <ArrowRight size={14} /></Link></div>{data.news.length ? <div className="space-y-3">{data.news.slice(0, 2).map((post) => <Link key={post.id} to="/news" className="block rounded-xl bg-slate-50 p-3.5 hover:bg-teal-50/60 dark:bg-slate-800/70 dark:hover:bg-slate-800"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{post.category}</span><span className="text-[10px] text-slate-400">{format(new Date(post.createdAt), "MMM d")}</span></div><p className="text-sm font-semibold leading-snug">{post.title}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{post.body}</p></Link>)}</div> : <EmptyState title="No announcements yet" description="Department news and academic updates will appear here." icon={Newspaper} />}</Card>
      </div>
      <Card><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-400">Courses</p><h2 className="mt-1 text-lg font-bold">Your department curriculum</h2></div><span className="text-xs text-slate-500">{data.courses.length} courses</span></div>{data.courses.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.courses.slice(0, 6).map((course) => <div key={course.id} className="rounded-xl border border-slate-100 p-3.5 dark:border-slate-800"><p className="text-xs font-bold text-teal-700 dark:text-teal-400">{course.code} · {course.level}</p><p className="mt-1 font-semibold">{course.title}</p><p className="mt-2 text-xs text-slate-500">{course._count?.slides ?? 0} materials · {course._count?.quizzes ?? 0} quizzes</p></div>)}</div> : <EmptyState title="Courses are being prepared" description="Your course list will appear here once it is available." />}</Card>
      {data.notifications.length > 0 && <Link to="/notifications" className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400"><Bell size={16} /> View {data.notifications.length} recent notifications <ArrowRight size={14} /></Link>}
    </div>
  );
}
