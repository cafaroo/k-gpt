"use client";

import { HardDriveDownload, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DeleteAnalysisButton({
  analysisId,
  redirectTo,
  label = "Delete",
  compact = false,
}: {
  analysisId: string;
  redirectTo?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (busy) return;
    const ok = window.confirm(
      "Delete this analysis permanently? The uploaded video and all analysis data will be removed."
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/analyze/v2/api/analyses/${analysisId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        window.alert("Delete failed — check console.");
        console.error(await res.text());
        setBusy(false);
        return;
      }
      startTransition(() => {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      });
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  };

  const disabled = busy || isPending;
  if (compact) {
    return (
      <button
        className="inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
        disabled={disabled}
        onClick={click}
        title="Delete analysis"
        type="button"
      >
        <Trash2 className="size-3.5" />
      </button>
    );
  }
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
      disabled={disabled}
      onClick={click}
      type="button"
    >
      <Trash2 className="size-3.5" />
      {disabled ? "Deleting…" : label}
    </button>
  );
}

export function ClearAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (busy) return;
    const first = window.confirm(
      "Delete ALL analyses and uploaded videos for your account? This cannot be undone."
    );
    if (!first) return;
    const confirmWord = window.prompt('Type "DELETE" (uppercase) to confirm:');
    if (confirmWord !== "DELETE") {
      window.alert("Cancelled — confirmation text did not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/analyze/v2/api/analyses", {
        method: "DELETE",
      });
      if (!res.ok) {
        window.alert("Clear-all failed — check console.");
        console.error(await res.text());
        setBusy(false);
        return;
      }
      const data = (await res.json()) as {
        deleted: { analyses: number; videos: number; blobs: number };
      };
      window.alert(
        `Cleared: ${data.deleted.analyses} analyses · ${data.deleted.videos} videos · ${data.deleted.blobs} blob files`
      );
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
      disabled={busy}
      onClick={click}
      type="button"
    >
      <Trash2 className="size-3.5" />
      {busy ? "Clearing…" : "Clear all"}
    </button>
  );
}

export function FreeStorageButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (busy) return;
    const ok = window.confirm(
      "Free storage by removing uploaded video files?\n\nThe analyses, insights, scores and JSON payloads stay intact. Only the video player on per-video pages goes offline (the uploaded .mp4 / .mov binaries are permanently deleted from Vercel Blob).\n\nContinue?"
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/analyze/v2/api/videos/blobs", {
        method: "DELETE",
      });
      if (!res.ok) {
        window.alert("Purge failed — check console.");
        console.error(await res.text());
        setBusy(false);
        return;
      }
      const data = (await res.json()) as {
        purged: { videos: number; blobs: number };
      };
      window.alert(
        `Freed storage: ${data.purged.videos} videos · ${data.purged.blobs} blob files removed. Analyses preserved.`
      );
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
      disabled={busy}
      onClick={click}
      type="button"
    >
      <HardDriveDownload className="size-3.5" />
      {busy ? "Purging…" : "Free storage"}
    </button>
  );
}
