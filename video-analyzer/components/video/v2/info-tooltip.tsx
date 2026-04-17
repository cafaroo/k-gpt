"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { METRIC_DESCRIPTIONS } from "@/lib/video/v2/metric-descriptions";

type Side = "top" | "right" | "bottom" | "left";

interface InfoTooltipProps {
  metricKey: string;
  side?: Side;
  className?: string;
}

export function InfoTooltip({ metricKey, side = "top", className }: InfoTooltipProps) {
  const info = METRIC_DESCRIPTIONS[metricKey];

  // Render nothing for unknown metric keys
  if (!info) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Learn about ${info.label}`}
          className={cn(
            "inline-flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
            className
          )}
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className="w-80 space-y-3 text-sm">
        {/* Header */}
        <div>
          <p className="font-semibold leading-snug">{info.label}</p>
          <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {info.unit}
          </span>
        </div>

        {/* Long description */}
        <p className="text-muted-foreground leading-relaxed text-xs">{info.long}</p>

        <Separator />

        {/* How to read */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            How to read
          </p>
          <p className="text-xs italic text-foreground leading-relaxed">{info.howToRead}</p>
        </div>

        {/* Research link */}
        {info.sourceUrl && (
          <a
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
            href={info.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Research source
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
