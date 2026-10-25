import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { Button, Card, Loading } from "./components/ui";

const AuthPage = lazy(() => import("./pages/AuthPages").then(({ AuthPage }) => ({ default: AuthPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then(({ AdminPage }) => ({ default: AdminPage })));
const ClassesPage = lazy(() => import("./pages/ClassesPage").then(({ ClassesPage }) => ({ default: ClassesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(({ DashboardPage }) => ({ default: DashboardPage })));
const MaterialsPage = lazy(() => import("./pages/MaterialsPage").then(({ MaterialsPage }) => ({ default: MaterialsPage })));
const NewsPage = lazy(() => import("./pages/NewsPage").then(({ NewsPage }) => ({ default: NewsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(({ NotificationsPage }) => ({ default: NotificationsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(({ ProfilePage }) => ({ default: ProfilePage })));
const QuizAttemptPage = lazy(() => import("./pages/QuizzesPage").then(({ QuizAttemptPage }) => ({ default: QuizAttemptPage })));
const QuizzesPage = lazy(() => import("./pages/QuizzesPage").then(({ QuizzesPage }) => ({ default: QuizzesPage })));

function Protected({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, signOut } = useAuth();
  if (loading) return <Loading label="Preparing your account…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  if (user.role === "STUDENT" && !user.cohortVerified) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 dark:bg-slate-950"><Card className="w-full max-w-lg text-center"><span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"><ShieldCheck size={26} /></span><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Account verification</p><h1 className="mt-2 text-2xl font-bold">Your student details are being reviewed</h1><p className="mt-3 text-sm leading-relaxed text-slate-500">An administrator must verify your department and study level before you can access courses, learning materials, quizzes, or classes.</p><p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">{user.department.replaceAll("_", " ")} · {user.level}</p><Button variant="secondary" className="mt-5 w-full" onClick={signOut}>Sign out</Button></Card></main>;
  }
  return children;
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
    <Route path="/reset-password" element={<AuthPage mode="reset" />} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route element={<Protected><AppShell /></Protected>}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/slides" element={<MaterialsPage mode="slides" />} />
      <Route path="/past-questions" element={<MaterialsPage mode="past-questions" />} />
      <Route path="/quizzes" element={<QuizzesPage />} />
      <Route path="/quizzes/:quizId" element={<QuizAttemptPage />} />
      <Route path="/classes" element={<ClassesPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/admin" element={<Protected adminOnly><AdminPage /></Protected>} />
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}

export default function App() {
  return <Suspense fallback={<Loading label="Loading your workspace…" />}><AppRoutes /></Suspense>;
}
