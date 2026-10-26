import { useEffect, useState, type FormEvent } from "react";
import { Check, ClipboardCheck, GraduationCap, Plus, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { FilePreviewDialog } from "../components/FilePreviewDialog";
import { api, departmentLabel, getErrorMessage } from "../lib/api";
import type { Course, PastQuestion, Slide, User } from "../lib/types";
import { Button, Card, EmptyState, ErrorNotice, Field, Input, Loading, PageHeading, Select } from "../components/ui";

interface AdminUser extends Pick<User, "id" | "name" | "email" | "role" | "department" | "level" | "cohortVerified"> {
  createdAt: string;
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [pastQuestions, setPastQuestions] = useState<(PastQuestion & { uploadedBy: { name: string } })[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [preview, setPreview] = useState<{ title: string; fileUrl: string; mimeType: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [usersResult, pendingResult, pendingQuestionsResult, coursesResult] = await Promise.all([
        api.get<{ users: AdminUser[] }>("/admin/users"),
        api.get<{ slides: Slide[] }>("/admin/pending-slides"),
        api.get<{ pastQuestions: (PastQuestion & { uploadedBy: { name: string } })[] }>("/admin/pending-past-questions"),
        api.get<{ courses: Course[] }>("/courses")
      ]);
      setUsers(usersResult.data.users);
      setSlides(pendingResult.data.slides);
      setPastQuestions(pendingQuestionsResult.data.pastQuestions);
      setCourses(coursesResult.data.courses);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Admin workspace could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function updateRole(id: string, role: string) {
    try {
      const result = await api.patch<{ user: AdminUser }>(`/admin/users/${id}/role`, { role });
      setUsers((items) => items.map((item) => item.id === id ? { ...item, role: result.data.user.role } : item));
      toast.success("Account role updated.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Account role could not be updated."));
    }
  }

  async function updateCohort(
    id: string,
    cohort: { department?: User["department"]; level?: string; verified?: boolean }
  ) {
    try {
      const result = await api.patch<{ user: Pick<AdminUser, "id" | "department" | "level" | "cohortVerified"> }>(`/admin/users/${id}/cohort`, cohort);
      setUsers((items) => items.map((item) => item.id === id ? { ...item, ...result.data.user } : item));
      toast.success(cohort.verified ? "Student cohort verified." : "Student cohort updated and verification reset.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Student cohort could not be updated."));
    }
  }

  async function approve(slide: Slide) {
    try {
      await api.patch(`/materials/slides/${slide.id}/approval`, { approved: true });
      setSlides((items) => items.filter((item) => item.id !== slide.id));
      toast.success("Learning resource approved and shared.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Resource could not be approved."));
    }
  }

  async function approveQuestion(question: PastQuestion) {
    try {
      await api.patch(`/materials/past-questions/${question.id}/approval`, { approved: true });
      setPastQuestions((items) => items.filter((item) => item.id !== question.id));
      toast.success("Past paper approved and shared.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Past paper could not be approved."));
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = Object.fromEntries(new FormData(formElement).entries());
    setBusy(true);
    try {
      await api.post("/admin/users", data);
      toast.success("Account created.");
      setShowCreateUser(false);
      formElement.reset();
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Account could not be created."));
    } finally {
      setBusy(false);
    }
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await api.post("/courses", {
        code: form.get("code"),
        title: form.get("title"),
        department: form.get("department"),
        level: form.get("level"),
        description: form.get("description") || undefined
      });
      toast.success("Course created.");
      setShowCreateCourse(false);
      formElement.reset();
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Course could not be created."));
    } finally {
      setBusy(false);
    }
  }

  return <div><PageHeading eyebrow="Department controls" title="Administration" description="Manage department accounts, course catalogues, and learning resource approvals." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setShowCreateCourse(!showCreateCourse)}><Plus size={15} />Course</Button><Button onClick={() => setShowCreateUser(!showCreateUser)}><Plus size={15} />User</Button></div>} />
    {loading ? <Loading label="Loading admin controls…" /> : error ? <ErrorNotice message={error} retry={() => void load()} /> : <>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-3"><Card className="flex items-center gap-3"><Users className="text-teal-700" /><div><p className="text-2xl font-bold">{users.length}</p><p className="text-xs text-slate-500">Accounts</p></div></Card><Card className="flex items-center gap-3"><GraduationCap className="text-teal-700" /><div><p className="text-2xl font-bold">{courses.length}</p><p className="text-xs text-slate-500">Courses</p></div></Card><Card className="flex items-center gap-3"><ClipboardCheck className="text-teal-700" /><div><p className="text-2xl font-bold">{slides.length + pastQuestions.length}</p><p className="text-xs text-slate-500">Pending review</p></div></Card></div>
      {showCreateUser && <Card className="mb-5 border-teal-100 bg-teal-50/30 dark:border-teal-950 dark:bg-teal-950/20"><form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><h2 className="text-lg font-bold sm:col-span-2 xl:col-span-3">Create an account</h2><Field label="Full name"><Input name="name" required minLength={2} /></Field><Field label="Email"><Input name="email" type="email" required /></Field><Field label="Temporary password"><Input name="password" type="password" minLength={10} required /></Field><Field label="Role"><Select name="role"><option value="STUDENT">Student</option><option value="LECTURER">Lecturer</option><option value="ADMIN">Administrator</option></Select></Field><Field label="Department"><Select name="department">{["NURSING", "MIDWIFERY", "MENTAL_HEALTH"].map((item) => <option key={item} value={item}>{departmentLabel(item)}</option>)}</Select></Field><Field label="Level"><Select name="level">{["Level 100", "Level 200", "Level 300", "Level 400", "Postgraduate"].map((item) => <option key={item}>{item}</option>)}</Select></Field><Button type="submit" disabled={busy} className="sm:col-span-2 xl:col-span-3 xl:justify-self-end">{busy ? "Creating…" : "Create account"}</Button></form></Card>}
      {showCreateCourse && <Card className="mb-5 border-teal-100 bg-teal-50/30 dark:border-teal-950 dark:bg-teal-950/20"><form onSubmit={createCourse} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><h2 className="text-lg font-bold sm:col-span-2 xl:col-span-3">Add a course</h2><Field label="Course code"><Input name="code" required minLength={2} maxLength={20} placeholder="NUR 314" /></Field><Field label="Course title"><Input name="title" required minLength={3} maxLength={160} /></Field><Field label="Department"><Select name="department">{["NURSING", "MIDWIFERY", "MENTAL_HEALTH"].map((item) => <option key={item} value={item}>{departmentLabel(item)}</option>)}</Select></Field><Field label="Level"><Select name="level">{["Level 100", "Level 200", "Level 300", "Level 400", "Postgraduate"].map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="Description"><Input name="description" maxLength={1000} /></Field><Button type="submit" disabled={busy} className="self-end">{busy ? "Saving…" : "Save course"}</Button></form></Card>}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><Card className="p-0"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 className="flex items-center gap-2 font-bold"><Users size={17} className="text-teal-700" />People & access</h2><p className="mt-1 text-xs text-slate-500">Manage account roles and verify student department and study level.</p></div>{users.length ? <div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{users.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="truncate text-xs text-slate-500">{item.email} · {departmentLabel(item.department)} · {item.level}</p>{item.role === "STUDENT" && <div className="mt-2 flex flex-wrap items-center gap-2"><Select aria-label={`Department for ${item.name}`} value={item.department} onChange={(event) => void updateCohort(item.id, { department: event.target.value as User["department"] })} className="h-8 w-auto min-w-36 text-xs">{["NURSING", "MIDWIFERY", "MENTAL_HEALTH"].map((department) => <option key={department} value={department}>{departmentLabel(department)}</option>)}</Select><Select aria-label={`Study level for ${item.name}`} value={item.level} onChange={(event) => void updateCohort(item.id, { level: event.target.value })} className="h-8 w-auto min-w-32 text-xs">{["Level 100", "Level 200", "Level 300", "Level 400", "Postgraduate"].map((level) => <option key={level}>{level}</option>)}</Select><Button size="sm" variant={item.cohortVerified ? "ghost" : "secondary"} onClick={() => void updateCohort(item.id, { verified: !item.cohortVerified })}>{item.cohortVerified ? "Verified" : "Verify cohort"}</Button></div>}</div><Select aria-label={`Role for ${item.name}`} value={item.role} onChange={(event) => void updateRole(item.id, event.target.value)} className="h-9 w-auto min-w-32 text-xs"><option value="STUDENT">Student</option><option value="LECTURER">Lecturer</option><option value="ADMIN">Administrator</option></Select></div>)}</div> : <EmptyState title="No accounts yet" description="Create accounts to get your department started." icon={Users} />}</Card>
      <Card><div className="mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-teal-700" /><div><h2 className="font-bold">Learning materials to review</h2><p className="mt-1 text-xs text-slate-500">Lecturer uploads stay private until approved.</p></div></div><div className="space-y-3">{slides.map((slide) => <div key={slide.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{slide.course.code} · {slide.course.title}</p><h3 className="mt-1 font-semibold">{slide.title}</h3><p className="mt-1 text-xs text-slate-500">Shared by {slide.uploadedBy.name}</p><div className="mt-3 flex gap-2"><Button variant="secondary" size="sm" className="flex-1" onClick={() => setPreview({ title: slide.title, fileUrl: slide.fileUrl, mimeType: slide.mimeType })}>Review file</Button><Button size="sm" onClick={() => void approve(slide)}><Check size={14} />Approve</Button></div></div>)}{pastQuestions.map((question) => <div key={question.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{question.course.code} · {question.year} · {question.semester} semester</p><p className="mt-1 text-xs text-slate-500">Shared by {question.uploadedBy.name}</p><div className="mt-3 flex gap-2"><Button variant="secondary" size="sm" className="flex-1" onClick={() => setPreview({ title: `${question.course.code} ${question.year} past question`, fileUrl: question.fileUrl, mimeType: "application/pdf" })}>Review PDF</Button><Button size="sm" onClick={() => void approveQuestion(question)}><Check size={14} />Approve</Button></div></div>)}{!slides.length && !pastQuestions.length && <EmptyState title="All caught up" description="There are no learning resources waiting for approval." icon={ClipboardCheck} />}</div></Card></div>
    </>}
    {preview && <FilePreviewDialog {...preview} onClose={() => setPreview(null)} />}
  </div>;
}
