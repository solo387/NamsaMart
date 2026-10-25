import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, BarChart3, CircleHelp, Clock3, Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { api, getErrorMessage } from "../lib/api";
import type { Course, QuizSummary } from "../lib/types";
import { Button, Card, EmptyState, ErrorNotice, Field, Input, Loading, PageHeading, Select, Textarea } from "../components/ui";

type QuestionDraft = { text: string; type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER"; options: string; correctAnswer: string; points: number };
const emptyQuestion = (): QuestionDraft => ({ text: "", type: "MCQ", options: "", correctAnswer: "", points: 1 });

export function QuizzesPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [leaders, setLeaders] = useState<Record<string, { name: string; score: number | null }[]>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const canCreate = user?.role === "LECTURER" || user?.role === "ADMIN";

  async function load() {
    setLoading(true);
    try {
      const [quizResult, courseResult] = await Promise.all([
        api.get<{ quizzes: QuizSummary[] }>("/quizzes"),
        api.get<{ courses: Course[] }>("/courses")
      ]);
      setQuizzes(quizResult.data.quizzes);
      setCourses(courseResult.data.courses);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Quizzes could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function createQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quizQuestions = questions.map((question) => ({
      text: question.text,
      type: question.type,
      options: question.type === "MCQ" ? question.options.split("\n").map((option) => option.trim()).filter(Boolean) : question.type === "TRUE_FALSE" ? ["True", "False"] : undefined,
      correctAnswer: question.correctAnswer,
      points: Number(question.points)
    }));
    setBusy(true);
    try {
      await api.post("/quizzes", {
        title: form.get("title"),
        description: form.get("description") || undefined,
        courseId: form.get("courseId"),
        durationMinutes: Number(form.get("durationMinutes")),
        isPublished: form.get("isPublished") === "on",
        questions: quizQuestions
      });
      toast.success("Quiz created.");
      setShowCreate(false);
      setQuestions([emptyQuestion()]);
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Quiz could not be created."));
    } finally {
      setBusy(false);
    }
  }

  async function loadLeaders(quizId: string) {
    try {
      const result = await api.get<{ leaderboard: { user: { name: string }; score: number | null }[] }>(`/quizzes/${quizId}/leaderboard`);
      setLeaders((items) => ({ ...items, [quizId]: result.data.leaderboard.map(({ user: learner, score }) => ({ name: learner.name, score })) }));
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Leaderboard could not load."));
    }
  }

  async function publishQuiz(quizId: string) {
    try {
      await api.patch(`/quizzes/${quizId}/publish`, { isPublished: true });
      toast.success("Quiz published for students.");
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Quiz could not be published."));
    }
  }

  return (
    <div>
      <PageHeading eyebrow="Knowledge check" title="Quizzes" description="Build confidence with short, focused practice quizzes for your courses." action={canCreate ? <Button onClick={() => setShowCreate(!showCreate)}><Plus size={17} />{showCreate ? "Close builder" : "Create quiz"}</Button> : undefined} />
      {showCreate && canCreate && <Card className="mb-6 border-teal-100 bg-teal-50/30 dark:border-teal-950 dark:bg-teal-950/20"><form onSubmit={createQuiz} className="grid gap-4"><div><h2 className="text-lg font-bold">Quiz details</h2><p className="mt-1 text-xs text-slate-500">Answer keys stay private and are used only when submissions are scored.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Quiz title"><Input name="title" required minLength={3} maxLength={160} placeholder="e.g. Medication safety essentials" /></Field><Field label="Course"><Select name="courseId" defaultValue="" required><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</Select></Field><Field label="Time limit (minutes)"><Input name="durationMinutes" type="number" min={1} max={240} defaultValue={15} required /></Field><Field label="Description (optional)"><Input name="description" maxLength={2000} placeholder="What will this quiz cover?" /></Field></div>
        <div className="space-y-3">{questions.map((question, index) => <section key={index} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Question {index + 1}</h3>{questions.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setQuestions((items) => items.filter((_, current) => current !== index))}>Remove</Button>}</div><div className="grid gap-3 sm:grid-cols-2"><Field label="Question"><Textarea rows={2} required minLength={5} maxLength={1500} value={question.text} onChange={(event) => setQuestions((items) => items.map((item, current) => current === index ? { ...item, text: event.target.value } : item))} placeholder="Write a clear clinical learning question" /></Field><Field label="Question type"><Select value={question.type} onChange={(event) => setQuestions((items) => items.map((item, current) => current === index ? { ...item, type: event.target.value as QuestionDraft["type"], options: event.target.value === "TRUE_FALSE" ? "True\nFalse" : "" } : item))}><option value="MCQ">Multiple choice</option><option value="TRUE_FALSE">True or false</option><option value="SHORT_ANSWER">Short answer</option></Select></Field>{question.type === "MCQ" && <Field label="Answer options (one per line)"><Textarea rows={3} value={question.options} onChange={(event) => setQuestions((items) => items.map((item, current) => current === index ? { ...item, options: event.target.value } : item))} placeholder={"Assess airway\nCheck breathing\nEscalate concerns"} required /></Field>}<Field label={question.type === "MCQ" ? "Correct option (enter it exactly)" : question.type === "TRUE_FALSE" ? "Correct answer" : "Expected short answer"}><Input value={question.correctAnswer} onChange={(event) => setQuestions((items) => items.map((item, current) => current === index ? { ...item, correctAnswer: event.target.value } : item))} placeholder={question.type === "TRUE_FALSE" ? "True or False" : "Enter the correct answer"} required /></Field><Field label="Points"><Input type="number" min={1} max={100} value={question.points} onChange={(event) => setQuestions((items) => items.map((item, current) => current === index ? { ...item, points: Number(event.target.value) } : item))} /></Field></div></section>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="secondary" onClick={() => setQuestions((items) => [...items, emptyQuestion()])}><Plus size={16} /> Add question</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" className="h-4 w-4 accent-teal-700" /> Publish for students</label><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Save quiz"}</Button></div>
      </form></Card>}
      {loading ? <Loading label="Loading course quizzes…" /> : error ? <ErrorNotice message={error} retry={() => void load()} /> : quizzes.length ? <div className="grid gap-4 lg:grid-cols-2">{quizzes.map((quiz) => {
        const entries = leaders[quiz.id];
        return <Card key={quiz.id}>
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><CircleHelp size={21} /></span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${quiz.isPublished ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>{quiz.isPublished ? quiz.attempts[0]?.submittedAt ? `Best score ${quiz.attempts[0].score ?? 0}%` : "Published" : "Draft"}</span>
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{quiz.course.code} · {quiz.course.title}</p>
          <h2 className="mt-1 text-xl font-bold">{quiz.title}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{quiz.description || "Practice key ideas from your course."}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Clock3 size={14} />{quiz.durationMinutes} minutes</span>
            <span className="inline-flex items-center gap-1"><CircleHelp size={14} />{quiz._count.questions} questions</span>
            <span>{quiz._count.attempts} attempts</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {quiz.isPublished && <Button variant="ghost" size="sm" onClick={() => void loadLeaders(quiz.id)}><Trophy size={15} />Leaderboard</Button>}
            {canCreate && !quiz.isPublished && <Button variant="secondary" size="sm" onClick={() => void publishQuiz(quiz.id)}>Publish draft</Button>}
            {(quiz.isPublished || quiz.attempts[0]?.submittedAt) && <Link to={`/quizzes/${quiz.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">{quiz.attempts[0]?.submittedAt ? quiz.isPublished ? "Try again" : "Review answers" : "Start quiz"}<ArrowRight size={15} /></Link>}
          </div>
          {entries && <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><h3 className="mb-2 text-xs font-bold">Course leaderboard</h3>{entries.length ? entries.map((entry, index) => <div key={entry.name} className="flex justify-between py-1 text-xs"><span>{index + 1}. {entry.name}</span><span className="font-bold text-teal-700">{entry.score ?? 0}%</span></div>) : <p className="text-xs text-slate-500">No submitted attempts yet.</p>}</div>}
        </Card>;
      })}</div> : <EmptyState title="No quizzes available" description={canCreate ? "Create a quiz for a course when you are ready to assess your students." : "Published quizzes for your courses will be ready to practise here."} icon={CircleHelp} />}
    </div>
  );
}

export function QuizAttemptPage() {
  const [quiz, setQuiz] = useState<{ id: string; title: string; durationMinutes: number; course: { code: string; title: string }; questions: { id: string; text: string; type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER"; options: string[] | null; points: number }[] } | null>(null);
  const [attempt, setAttempt] = useState<{ id: string; startedAt: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [review, setReview] = useState<{ score: number | null; review: { id: string; text: string; correctAnswer: string; yourAnswer: string | null; points: number }[] } | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{ score: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const submitted = useRef(false);
  const { quizId = "" } = useParams();

  useEffect(() => {
    async function start() {
      try {
        const quizResult = await api.get<{ quiz: NonNullable<typeof quiz> & { isPublished: boolean; attempts: { id: string; score: number | null; submittedAt: string | null; startedAt: string }[] } }>(`/quizzes/${quizId}`);
        const quizData = quizResult.data.quiz;
        setQuiz(quizData);
        const priorAttempt = !quizData.isPublished ? quizData.attempts[0] : undefined;
        if (priorAttempt) {
          setAttempt({ id: priorAttempt.id, startedAt: priorAttempt.startedAt });
          setSubmittedResult({ score: priorAttempt.score });
          setSubmitMessage(`Your previous attempt score: ${priorAttempt.score ?? 0}%.`);
          const result = await api.get<{ score: number | null; review: NonNullable<typeof review>["review"] }>(`/quizzes/${quizId}/attempts/${priorAttempt.id}/review`);
          setReview(result.data);
        } else {
          const attemptResult = await api.post<{ attempt: { id: string; startedAt: string } }>(`/quizzes/${quizId}/attempts`);
          setAttempt(attemptResult.data.attempt);
          setRemaining(Math.max(0, Math.ceil((new Date(attemptResult.data.attempt.startedAt).getTime() + quizData.durationMinutes * 60_000 - Date.now()) / 1000)));
        }
        setError("");
      } catch (cause) {
        setError(getErrorMessage(cause, "The quiz could not be opened."));
      } finally {
        setLoading(false);
      }
    }
    void start();
  }, [quizId]);

  async function submit() {
    if (!attempt || submitted.current || busy) return;
    submitted.current = true;
    setBusy(true);
    try {
      const response = await api.post<{ attempt: { score: number | null } }>(`/quizzes/${quizId}/attempts/${attempt.id}/submit`, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      });
      setSubmitMessage(`Assessment complete — you scored ${response.data.attempt.score ?? 0}%.`);
      setSubmittedResult(response.data.attempt);
      toast.success("Your quiz has been submitted.");
    } catch (cause) {
      submitted.current = false;
      toast.error(getErrorMessage(cause, "Your answers could not be submitted."));
    } finally {
      setBusy(false);
    }
  }

  async function loadReview() {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const result = await api.get<{ score: number | null; review: NonNullable<typeof review>["review"] }>(`/quizzes/${quizId}/attempts/${attempt.id}/review`);
      setReview(result.data);
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Answer review is not available yet."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!attempt || !quiz || submittedResult) return;
    const update = () => {
      const endAt = new Date(attempt.startedAt).getTime() + quiz.durationMinutes * 60_000;
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [attempt, quiz, submittedResult]);

  useEffect(() => {
    if (remaining === 0 && attempt && quiz && !submittedResult && !loading && !submitted.current) void submit();
  }, [remaining, attempt, quiz, submittedResult, loading]);

  if (loading) return <Loading label="Opening your quiz…" />;
  if (error || !quiz) return <ErrorNotice message={error || "Quiz not found."} />;
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");

  return <div className="mx-auto max-w-3xl"><PageHeading eyebrow={quiz.course.code} title={quiz.title} description={`${quiz.questions.length} questions · ${quiz.durationMinutes} minutes`} action={!submittedResult && <span role="timer" aria-live="off" className={`rounded-xl px-3 py-2 font-mono text-sm font-bold ${remaining < 60 ? "bg-rose-100 text-rose-700" : "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"}`}><Clock3 size={15} className="mr-1 inline" />{minutes}:{seconds}</span>} />
    {submittedResult ? <Card>
      <div className="mb-5 rounded-2xl bg-teal-50 p-5 dark:bg-teal-950/50"><p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Results</p><p className="mt-1 text-3xl font-bold">{submittedResult.score ?? 0}%</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{submitMessage}</p></div>
      {review ? <>
        <h2 className="mb-4 text-lg font-bold">Answer review</h2>
        <div className="space-y-4">{review.review.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs font-bold text-teal-700">Question {index + 1} · {item.points} pts</p><p className="mt-1 font-semibold">{item.text}</p><p className="mt-2 text-sm text-slate-500">Your answer: {item.yourAnswer || "Not answered"}</p><p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Expected answer: {item.correctAnswer}</p></div>)}</div>
      </> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600 dark:text-slate-300">Answer review becomes available after your lecturer closes the quiz.</p><Button variant="secondary" onClick={() => void loadReview()} disabled={busy}>{busy ? "Checking…" : "Check answer review"}</Button></div>}
    </Card> : <>
      <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-900"><span>{Object.keys(answers).length} of {quiz.questions.length} answered</span><span className="font-semibold">Read each question carefully</span></div>
      <div className="space-y-4">{quiz.questions.map((question, index) => <Card key={question.id}><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-sm font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">{index + 1}</span><div className="flex-1"><div className="flex items-start justify-between gap-3"><p className="font-semibold leading-relaxed">{question.text}</p><span className="shrink-0 text-[10px] text-slate-400">{question.points} pt{question.points === 1 ? "" : "s"}</span></div><div className="mt-4 grid gap-2">{question.type === "SHORT_ANSWER" ? <Input aria-label={`Answer question ${index + 1}`} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((items) => ({ ...items, [question.id]: event.target.value }))} placeholder="Type your short answer" /> : (question.options ?? []).map((option) => <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${answers[question.id] === option ? "border-teal-500 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-100" : "border-slate-200 hover:border-teal-300 dark:border-slate-700"}`}><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((items) => ({ ...items, [question.id]: option }))} className="h-4 w-4 accent-teal-700" />{option}</label>)}</div></div></div></Card>)}</div>
      {submitMessage && <p role="alert" className="mt-3 text-sm text-rose-600">{submitMessage}</p>}<div className="mt-6 flex justify-end"><Button onClick={() => void submit()} disabled={busy}>{busy ? "Submitting…" : "Submit quiz"}</Button></div>
    </>}
  </div>;
}
