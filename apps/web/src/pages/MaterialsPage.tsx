import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { Bookmark, Check, Download, FileText, Filter, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { api, formatBytes, getErrorMessage } from "../lib/api";
import type { Course, PastQuestion, Slide } from "../lib/types";
import { Button, Card, EmptyState, ErrorNotice, Field, Input, Loading, PageHeading, Select } from "../components/ui";

export function MaterialsPage({ mode }: { mode: "slides" | "past-questions" }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [questions, setQuestions] = useState<PastQuestion[]>([]);
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadContent() {
    setLoading(true);
    try {
      const [courseResult, contentResult] = await Promise.all([
        api.get<{ courses: Course[] }>("/courses"),
        api.get<{ slides: Slide[] } | { pastQuestions: PastQuestion[] }>(mode === "slides" ? "/materials/slides" : "/materials/past-questions", {
          params: { courseId: courseId || undefined, search: search || undefined, year: year || undefined, semester: semester || undefined }
        })
      ]);
      setCourses(courseResult.data.courses);
      if (mode === "slides" && "slides" in contentResult.data) setSlides(contentResult.data.slides);
      if (mode === "past-questions" && "pastQuestions" in contentResult.data) setQuestions(contentResult.data.pastQuestions);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "These learning resources could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadContent(); }, [mode, courseId, search, year, semester]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      await api.post(`/materials/${mode === "slides" ? "slides" : "past-questions"}`, new FormData(form), { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(mode === "slides" ? "Material uploaded. It will be visible after approval." : "Past question uploaded. It will be visible after admin approval.");
      form.reset();
      await loadContent();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBookmark(slide: Slide) {
    try {
      await api.put(`/materials/slides/${slide.id}/bookmark`);
      setSlides((items) => items.map((item) => item.id === slide.id ? { ...item, bookmarked: !item.bookmarked } : item));
      toast.success(slide.bookmarked ? "Bookmark removed." : "Saved to your bookmarks.");
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  }

  async function toggleStudied(question: PastQuestion) {
    try {
      const result = await api.put<{ studied: boolean }>(`/materials/past-questions/${question.id}/studied`);
      setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, studied: result.data.studied } : item));
      toast.success(result.data.studied ? "Marked as studied." : "Study status cleared.");
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  }

  const canUpload = user?.role === "LECTURER" || user?.role === "ADMIN";

  return (
    <div>
      <PageHeading eyebrow={mode === "slides" ? "Study library" : "Exam preparation"} title={mode === "slides" ? "Learning materials" : "Past questions"} description={mode === "slides" ? "Course notes and resources curated for your department." : "Practice with papers from previous examinations and track your revision."} />
      {canUpload && <Card className="mb-6 border-teal-100 bg-teal-50/40 dark:border-teal-950 dark:bg-teal-950/20"><form onSubmit={upload} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end"><div className="sm:col-span-2 lg:col-span-4"><div className="flex items-center gap-2 font-semibold"><UploadCloud size={18} className="text-teal-700" /> Share a {mode === "slides" ? "learning resource" : "past exam paper"}</div><p className="mt-1 text-xs text-slate-500">{mode === "slides" ? "PDF, PowerPoint, Word, and MP4 files up to 100 MB. Lecturer uploads require admin approval." : "Past exam papers must be PDF files."}</p></div>
          <Field label="Course"><Select name="courseId" required defaultValue=""><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</Select></Field>
          {mode === "slides" ? <Field label="Resource title"><Input name="title" required minLength={3} maxLength={160} placeholder="e.g. Wound care principles" /></Field> : <><Field label="Exam year"><Input name="year" type="number" required min={2000} max={new Date().getFullYear() + 1} placeholder="2024" /></Field><Field label="Semester"><Select name="semester" required defaultValue=""><option value="" disabled>Select semester</option><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></Select></Field></>}
          {mode === "slides" && <Field label="Description (optional)"><Input name="description" maxLength={1000} placeholder="Briefly describe this resource" /></Field>}
          <Field label="Choose file"><Input name="file" type="file" required accept={mode === "slides" ? ".pdf,.ppt,.pptx,.doc,.docx,.mp4" : ".pdf,application/pdf"} className="h-auto py-2 file:mr-2 file:rounded-lg file:border-0 file:bg-teal-50 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-teal-800" /></Field>
          <Button type="submit" disabled={busy} className="sm:col-span-2 lg:col-span-1">{busy ? "Uploading…" : "Upload"}</Button>
        </form></Card>}
      <Card className="mb-5 p-3.5"><div className="grid gap-3 sm:grid-cols-[1fr_1.1fr_auto]">
        {mode === "slides" && <label className="relative"><span className="sr-only">Search learning materials</span><Search size={17} className="absolute left-3 top-3 text-slate-400" /><Input aria-label="Search learning materials" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles and topics…" className="pl-9" /></label>}
        <label><span className="sr-only">Filter by course</span><Select aria-label="Filter by course" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">All courses</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</Select></label>
        {mode === "past-questions" && <><label><span className="sr-only">Filter by year</span><Select aria-label="Filter by year" value={year} onChange={(event) => setYear(event.target.value)}><option value="">All years</option>{Array.from({ length: 10 }, (_, index) => String(new Date().getFullYear() - index)).map((item) => <option key={item}>{item}</option>)}</Select></label><label><span className="sr-only">Filter by semester</span><Select aria-label="Filter by semester" value={semester} onChange={(event) => setSemester(event.target.value)}><option value="">All semesters</option><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></Select></label></>}
        <span className="hidden items-center justify-center gap-1.5 px-2 text-xs text-slate-400 sm:flex"><Filter size={14} /> Filter by course</span>
      </div></Card>

      {loading ? <Loading label="Finding your course resources…" /> : error ? <ErrorNotice message={error} retry={() => void loadContent()} /> : mode === "slides" ? (
        slides.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{slides.map((slide) => <Card key={slide.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"><FileText size={21} /></span><button type="button" onClick={() => void toggleBookmark(slide)} aria-label={slide.bookmarked ? "Remove bookmark" : "Bookmark material"} aria-pressed={slide.bookmarked} className={`rounded-xl p-2 ${slide.bookmarked ? "text-amber-500" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Bookmark size={18} fill={slide.bookmarked ? "currentColor" : "none"} /></button></div><p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{slide.course.code} · {slide.course.level}</p><h2 className="mt-1 text-lg font-bold leading-snug">{slide.title}</h2><p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-500">{slide.description || `${slide.course.title} learning resource.`}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800"><span>{formatBytes(slide.fileSize)} · {slide.uploadedBy.name}</span><span>{format(new Date(slide.createdAt), "MMM d, yyyy")}</span></div><a href={slide.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"><Download size={16} /> Preview / download</a></Card>)}</div> : <EmptyState title="No materials found" description={search || courseId ? "Try changing your search or filters." : "Your lecturer's course notes and resources will appear here."} icon={FileText} />
      ) : questions.length ? <div className="grid gap-3">{questions.map((question) => <Card key={question.id} className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><FileText size={21} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{question.course.code} · {question.semester.toLowerCase()} semester</p><h2 className="mt-1 font-bold">{question.course.title} — {question.year}</h2><p className="mt-1 text-xs text-slate-500">Exam paper · PDF</p></div><Button variant={question.studied ? "secondary" : "ghost"} size="sm" aria-pressed={question.studied} onClick={() => void toggleStudied(question)}><Check size={15} />{question.studied ? "Studied" : "Mark studied"}</Button><a href={question.fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${question.course.code} ${question.year} past question`} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"><Download size={15} /> Open paper</a></Card>)}</div> : <EmptyState title="No past questions found" description="Try a different course, year, or semester filter. Past papers will appear here as lecturers add them." icon={FileText} />}
    </div>
  );
}
