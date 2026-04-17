import Link from "next/link";
import { redirect } from "next/navigation";

export default function AnalyzeV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.ANALYZE_V2_ENABLED !== "on") {
    redirect("/analyze");
  }
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center gap-6">
        <Link className="font-semibold" href="/analyze/v2">
          analyzer v2
        </Link>
        <Link
          className="text-sm text-muted-foreground hover:text-foreground"
          href="/analyze/v2"
        >
          Upload
        </Link>
        <Link
          className="text-sm text-muted-foreground hover:text-foreground"
          href="/analyze/v2/dashboard"
        >
          Dashboard
        </Link>
      </nav>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
