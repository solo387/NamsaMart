import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Activity, Bell, BookOpen, CalendarDays, ChevronDown, CircleHelp, GraduationCap, Home,
  LogOut, Menu, Moon, Newspaper, ShieldCheck, Sun, UserRound, X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { api, departmentLabel } from "../lib/api";
import { socketUrl } from "../lib/runtime-config";
import type { NotificationItem } from "../lib/types";

const mainLinks = [
  { to: "/dashboard", label: "Home", icon: Home, mobile: true },
  { to: "/slides", label: "Learning materials", short: "Slides", icon: BookOpen, mobile: true },
  { to: "/past-questions", label: "Past questions", icon: CircleHelp },
  { to: "/quizzes", label: "Quizzes", icon: GraduationCap, mobile: true },
  { to: "/classes", label: "Online classes", short: "Classes", icon: CalendarDays, mobile: true },
  { to: "/news", label: "News & announcements", icon: Newspaper },
  { to: "/profile", label: "Profile & settings", short: "Profile", icon: UserRound, mobile: true }
];

function navClasses(active: boolean) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`;
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem("namsamart-theme") === "dark");
  const [unread, setUnread] = useState(0);
  const initials = user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() ?? "NM";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("namsamart-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    void api.get<{ unreadCount: number }>("/notifications").then((result) => setUnread(result.data.unreadCount)).catch(() => undefined);
    const token = localStorage.getItem("namsamart-token");
    if (!token) return;
    const socket = io(socketUrl, { auth: { token } });
    socket.on("notification:new", (notification: NotificationItem) => {
      setUnread((count) => count + 1);
      toast(notification.message, { action: notification.link ? { label: "Open", onClick: () => { window.location.href = notification.link!; } } : undefined });
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const pageTitle = useMemo(() => mainLinks.find((link) => link.to === location.pathname)?.label ?? "Learning space", [location.pathname]);
  const links = user?.role === "ADMIN" ? [...mainLinks, { to: "/admin", label: "Administration", icon: ShieldCheck, mobile: false }] : mainLinks;

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-slate-900 dark:bg-slate-950 dark:text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-700 text-white"><Activity size={23} /></span>
          <span><span className="block text-lg font-bold tracking-tight">NamsaMart</span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">Health Sciences</span></span>
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-1">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Learning space</p>
          {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => navClasses(isActive)}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
        <div className="rounded-2xl bg-teal-50 p-4 dark:bg-teal-950/50">
          <p className="text-xs font-semibold text-teal-900 dark:text-teal-100">Keep learning together</p>
          <p className="mt-1 text-xs leading-relaxed text-teal-800/75 dark:text-teal-200/70">Your courses, resources, and clinical learning in one place.</p>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl p-2">
          <Avatar name={user?.name ?? "NamsaMart"} avatarUrl={user?.avatarUrl} initials={initials} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-slate-500">{user ? departmentLabel(user.department) : ""}</p></div>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Sign out" onClick={signOut}><LogOut size={17} /></button>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-9">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{departmentLabel(user?.department ?? "")} · {user?.level}</p><p className="text-sm font-bold lg:hidden">{pageTitle}</p></div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setDark(!dark)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
              <Link to="/notifications" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}><Bell size={19} />{unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}</Link>
              <Link to="/profile" className="ml-1 hidden items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 sm:flex dark:hover:bg-slate-800"><Avatar name={user?.name ?? "Student"} avatarUrl={user?.avatarUrl} initials={initials} small /><span className="max-w-28 truncate text-sm font-semibold">{user?.name}</span><ChevronDown size={14} className="text-slate-400" /></Link>
            </div>
          </div>
          {mobileOpen && <nav aria-label="Mobile navigation" className="mx-auto mt-3 max-w-7xl space-y-1 border-t border-slate-100 pt-3 lg:hidden dark:border-slate-800">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => navClasses(isActive)}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>}
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-9 lg:pb-10 lg:pt-8"><Outlet /></main>
      </div>
      <nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-2 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        {mainLinks.filter((link) => link.mobile).map(({ to, short, label, icon: Icon }) => <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${isActive ? "text-teal-700 dark:text-teal-300" : "text-slate-500 dark:text-slate-400"}`}><Icon size={19} aria-hidden="true" /><span>{short ?? label}</span></NavLink>)}
      </nav>
    </div>
  );
}

function Avatar({ name, avatarUrl, initials, small = false }: { name: string; avatarUrl: string | null | undefined; initials: string; small?: boolean }) {
  return avatarUrl
    ? <img src={avatarUrl} alt={`${name}'s profile`} className={`${small ? "h-8 w-8" : "h-9 w-9"} rounded-full object-cover`} />
    : <span aria-label={name} className={`grid shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-800 dark:bg-teal-900 dark:text-teal-100 ${small ? "h-8 w-8" : "h-9 w-9"}`}>{initials}</span>;
}
