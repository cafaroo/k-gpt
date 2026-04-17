"use client";

import { Download } from "lucide-react";

type Props = {
  href: string;
  label?: string;
};

export function ExportButton({ href, label = "Export" }: Props) {
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
      download
      href={href}
    >
      <Download className="size-3.5" />
      {label}
    </a>
  );
}
