import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, BookOpenCheck, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, registerSchema } from "@namsamart/shared";
import { useAuth } from "../auth/AuthContext";
import { api, getErrorMessage } from "../lib/api";
import { Button, Field, Input, Select } from "../components/ui";
import { departments } from "@namsamart/shared";

export function AuthPage({ mode }: { mode: "login" | "register" | "forgot" | "reset" }) {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    try {
      if (mode === "login") {
        const parsed = loginSchema.safeParse(values);
        if (!parsed.success) throw new Error("Enter a valid email address and password.");
        const user = await signIn(parsed.data.email, parsed.data.password);
        toast.success("Welcome back to your learning space.");
        navigate(user.role === "ADMIN" ? "/admin" : "/dashboard");
      } else if (mode === "register") {
        const parsed = registerSchema.safeParse(values);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the details and try again.");
        const response = await api.post<{ token: string }>("/auth/register", parsed.data);
        localStorage.setItem("namsamart-token", response.data.token);
        window.location.href = "/dashboard";
      } else if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email: values.email });
        toast.success("If your account exists, a password reset link is on its way.");
      } else {
        await api.post("/auth/reset-password", { token: search.get("token"), password: values.password });
        toast.success("Password reset. You can sign in now.");
        navigate("/login");
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message && !("response" in error) ? error.message : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    login: ["Welcome back", "Sign in to pick up where your clinical learning left off."],
    register: ["Create your account", "Join your department's learning and collaboration space."],
    forgot: ["Reset your password", "We'll email you a secure link to get back into your account."],
    reset: ["Choose a new password", "Use a strong password with at least 10 characters."]
  } as const;

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.04fr_0.96fr] dark:bg-slate-950">
      <section className="relative hidden overflow-hidden bg-[#0b5d59] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-32 top-20 h-96 w-96 rounded-full border border-white/10" /><div className="absolute -right-16 top-36 h-64 w-64 rounded-full border border-white/10" />
        <Link to="/" className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Activity size={24} /></span><span className="text-xl font-bold">NamsaMart <span className="font-normal text-teal-100">Health Sciences</span></span></Link>
        <div className="relative max-w-xl pb-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-50"><ShieldCheck size={15} /> Your department, in one place</div>
          <h1 className="text-5xl font-bold leading-[1.12] tracking-tight xl:text-6xl">Care begins with <span className="text-teal-200">learning together.</span></h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-teal-50/80">A shared learning space for the next generation of Nursing, Midwifery, and Mental Health professionals.</p>
          <div className="mt-9 flex flex-wrap gap-3 text-sm">{["Lecture notes", "Clinical quizzes", "Live classes"].map((item) => <span key={item} className="rounded-full border border-white/20 px-3 py-1.5">{item}</span>)}</div>
        </div>
        <p className="relative text-xs text-teal-100/70">Learn with care · Lead with knowledge</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 lg:hidden"><Activity size={21} /> NamsaMart Health Sciences</Link>
          <div className="mb-8"><p className="mb-2 text-sm font-bold text-teal-700 dark:text-teal-400">Your learning space</p><h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{titles[mode][0]}</h2><p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{titles[mode][1]}</p></div>
          <form onSubmit={handleSubmit} className="grid gap-5">
            {mode === "register" && <Field label="Full name"><Input name="name" autoComplete="name" placeholder="Your name" required minLength={2} maxLength={100} /></Field>}
            {mode !== "reset" && <Field label="Email address"><Input name="email" type="email" autoComplete="email" placeholder="you@college.edu" required /></Field>}
            {mode === "register" && <>
              <Field label="Department"><Select name="department" required defaultValue=""><option value="" disabled>Choose your department</option>{departments.map((item) => <option key={item} value={item}>{item.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}</Select></Field>
              <Field label="Level / year"><Select name="level" required defaultValue=""><option value="" disabled>Choose your current level</option>{["Level 100", "Level 200", "Level 300", "Level 400", "Postgraduate"].map((level) => <option key={level}>{level}</option>)}</Select></Field>
            </>}
            {(mode === "login" || mode === "register" || mode === "reset") && <Field label={mode === "login" ? "Password" : "Create password"} hint={mode !== "login" ? "At least 10 characters." : undefined}><Input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••••" required minLength={mode === "login" ? 1 : 10} maxLength={128} /></Field>}
            {mode === "login" && <div className="-mt-2 flex justify-end"><Link to="/forgot-password" className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400">Forgot password?</Link></div>}
            <Button type="submit" disabled={busy} className="mt-1 w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create student account" : mode === "forgot" ? "Send reset link" : "Update password"}{!busy && <ArrowRight size={17} />}</Button>
          </form>
          {mode === "login" && <p className="mt-7 text-center text-sm text-slate-500">New to NamsaMart? <Link to="/register" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">Create an account</Link></p>}
          {mode === "register" && <p className="mt-7 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">Sign in</Link></p>}
          {mode === "forgot" && <Link to="/login" className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal-700"><ArrowLeft size={15} /> Back to sign in</Link>}
          {mode === "reset" && !search.get("token") && <p role="alert" className="mt-5 text-sm text-rose-600">The password-reset link is missing. Request a new one.</p>}
          <div className="mt-10 flex items-center justify-center gap-5 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} /> Secure sign in</span><span className="inline-flex items-center gap-1.5"><BookOpenCheck size={13} /> Built for your studies</span></div>
        </div>
      </section>
    </div>
  );
}
