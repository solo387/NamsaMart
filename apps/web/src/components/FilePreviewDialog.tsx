import { useEffect, useRef } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { Button } from "./ui";

interface FilePreviewDialogProps {
  title: string;
  fileUrl: string;
  mimeType: string;
  onClose: () => void;
}

export function FilePreviewDialog({ title, fileUrl, mimeType, onClose }: FilePreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canPreviewPdf = mimeType === "application/pdf";
  const canPreviewVideo = mimeType === "video/mp4";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="file-preview-title"
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/75 dark:text-white"
    >
      <div className="flex h-full items-center justify-center p-2 sm:p-6" onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}>
        <section className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6">
            <h2 id="file-preview-title" className="min-w-0 flex-1 truncate font-semibold">{title}</h2>
            <a
              href={fileUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 dark:border-slate-700 dark:text-teal-300 dark:hover:bg-slate-800"
            >
              <Download size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${title} in a new tab`}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ExternalLink size={17} aria-hidden="true" />
            </a>
            <Button size="sm" variant="ghost" aria-label="Close preview" onClick={() => dialogRef.current?.close()}>
              <X size={18} aria-hidden="true" />
            </Button>
          </header>
          <div className="min-h-0 flex-1 bg-slate-100 dark:bg-slate-950">
            {canPreviewPdf ? (
              <iframe title={`PDF preview: ${title}`} src={fileUrl} referrerPolicy="no-referrer" className="h-full w-full border-0" />
            ) : canPreviewVideo ? (
              <div className="grid h-full place-items-center p-4">
                <video src={fileUrl} controls playsInline className="max-h-full max-w-full" aria-label={title}>
                  Your browser does not support MP4 playback. Use Download to save the video.
                </video>
              </div>
            ) : (
              <div className="grid h-full place-content-center justify-items-center gap-3 p-6 text-center">
                <p className="font-semibold">Preview isn’t available for this file type.</p>
                <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                  Download the file or open it in a new tab to view it with a compatible app.
                </p>
                <a href={fileUrl} download target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                  <Download size={16} aria-hidden="true" />
                  Download or open file
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </dialog>
  );
}
