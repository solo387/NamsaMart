import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { Loading } from "./components/ui";

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
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Preparing your account…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
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
