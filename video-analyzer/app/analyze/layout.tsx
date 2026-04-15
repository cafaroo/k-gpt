import Link from "next/link";
import { Toaster } from "sonner";

export default function AnalyzeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <Link className="flex items-center gap-2" href="/analyze">
          <span className="bg-primary/10 text-primary rounded-md px-2 py-1 text-sm font-semibold">
            VCA
          </span>
          <span className="text-sm font-medium">Video Content Analyzer</span>
        </Link>
        <span className="text-muted-foreground text-xs">
          Claude Sonnet 4.5 · ffmpeg.wasm
        </span>
      </header>
      <main className="flex-1">{children}</main>
      <Toaster position="top-center" />
    </div>
  );
}
