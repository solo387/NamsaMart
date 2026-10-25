import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { Megaphone, MessageCircle, Send, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { api, departmentLabel, getErrorMessage } from "../lib/api";
import type { NewsPost } from "../lib/types";
import { Button, Card, EmptyState, ErrorNotice, Field, Input, Loading, PageHeading, Select, Textarea } from "../components/ui";

export function NewsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [busy, setBusy] = useState(false);
  const canPost = user?.role === "LECTURER" || user?.role === "ADMIN";

  async function load() {
    setLoading(true);
    try {
      const result = await api.get<{ news: NewsPost[] }>("/news");
      setPosts(result.data.news);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "Department announcements could not load."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await api.post("/news", {
        title: form.get("title"),
        body: form.get("body"),
        imageUrl: form.get("imageUrl") || undefined,
        category: form.get("category"),
        department: form.get("department") || null
      });
      toast.success("Announcement published.");
      setShowCompose(false);
      formElement.reset();
      await load();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Announcement could not be published."));
    } finally {
      setBusy(false);
    }
  }

  async function comment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    try {
      const result = await api.post<{ comment: NewsPost["comments"][number] }>(`/news/${postId}/comments`, { body });
      setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...post.comments, result.data.comment] } : post));
      form.reset();
      toast.success("Comment added.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Comment could not be added."));
    }
  }

  async function reactTo(post: NewsPost) {
    const selected = post.myReaction ? undefined : "HELPFUL";
    try {
      const result = await api.put<{ reaction: string | null }>(`/news/${post.id}/reaction`, { reaction: selected ?? "HELPFUL" });
      const reaction = result.data.reaction;
      setPosts((items) => items.map((item) => item.id === post.id ? {
        ...item, myReaction: reaction,
        reactionCount: Math.max(0, item.reactionCount + (reaction ? item.myReaction ? 0 : 1 : -1))
      } : item));
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Reaction could not be saved."));
    }
  }

  return <div>
    <PageHeading eyebrow="Department bulletin" title="News & announcements" description="Academic notices, clinical learning opportunities, and moments from your department." action={canPost ? <Button onClick={() => setShowCompose(!showCompose)}><Megaphone size={17} />{showCompose ? "Close" : "Post update"}</Button> : undefined} />
    {showCompose && canPost && <Card className="mb-6 border-teal-100 bg-teal-50/30 dark:border-teal-950 dark:bg-teal-950/20"><form onSubmit={publish} className="grid gap-4"><h2 className="text-lg font-bold">Share an announcement</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Headline"><Input name="title" required minLength={5} maxLength={180} placeholder="e.g. Clinical skills lab schedule" /></Field><Field label="Category"><Select name="category" defaultValue="ACADEMIC"><option value="ACADEMIC">Academic</option><option value="GENERAL">General</option><option value="EVENT">Event</option><option value="URGENT">Urgent</option></Select></Field><Field label="Department"><Select name="department" defaultValue={user?.role === "ADMIN" ? "" : user?.department}><option value="">All departments</option><option value="NURSING">Nursing</option><option value="MIDWIFERY">Midwifery</option><option value="MENTAL_HEALTH">Mental Health</option></Select></Field><Field label="Image URL (optional)"><Input name="imageUrl" type="url" placeholder="https://…" /></Field></div><Field label="Announcement"><Textarea name="body" rows={5} required minLength={20} maxLength={12000} placeholder="Include the information students need, with dates and places where relevant." /></Field><div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish update"}</Button></div></form></Card>}
    {loading ? <Loading label="Loading department updates…" /> : error ? <ErrorNotice message={error} retry={() => void load()} /> : posts.length ? <div className="grid gap-4">{posts.map((post) => <Card key={post.id} className="overflow-hidden p-0"><div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">{post.author.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span><div><p className="text-sm font-semibold">{post.author.name}</p><p className="text-xs text-slate-500">{format(new Date(post.createdAt), "MMM d, yyyy · h:mm a")}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${post.category === "URGENT" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"}`}>{post.category}</span></div><p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{post.department ? departmentLabel(post.department) : "All departments"}</p><h2 className="mt-1 text-xl font-bold leading-snug">{post.title}</h2>{post.imageUrl && <img src={post.imageUrl} alt="" loading="lazy" className="mt-4 max-h-80 w-full rounded-xl object-cover" />}<p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{post.body}</p><div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800"><button onClick={() => void reactTo(post)} aria-pressed={!!post.myReaction} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${post.myReaction ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><ThumbsUp size={15} />Helpful <span>{post.reactionCount}</span></button><span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><MessageCircle size={15} />{post.comments.length} comments</span></div>
        {post.comments.length > 0 && <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">{post.comments.map((item) => <div key={item.id} className="text-xs"><span className="font-semibold">{item.user.name}</span><span className="ml-2 text-[10px] text-slate-400">{format(new Date(item.createdAt), "MMM d · h:mm a")}</span><p className="mt-0.5 text-slate-600 dark:text-slate-300">{item.body}</p></div>)}</div>}
        <form onSubmit={(event) => void comment(event, post.id)} className="mt-3 flex gap-2"><label htmlFor={`comment-${post.id}`} className="sr-only">Comment on {post.title}</label><Input id={`comment-${post.id}`} name="body" required minLength={1} maxLength={2000} placeholder="Add a thoughtful comment…" className="h-10" /><Button type="submit" size="sm" aria-label="Post comment"><Send size={15} /></Button></form></div></Card>)}</div> : <EmptyState title="It's quiet here for now" description="Department announcements and learning opportunities will appear as they are shared." icon={Megaphone} />}
  </div>;
}
