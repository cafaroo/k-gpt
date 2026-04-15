"use client";

import { Check, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Props = {
  steps: readonly string[];
  currentStep: string;
  progress: number;
  error?: string | null;
};

export function ExtractionProgress({
  steps,
  currentStep,
  progress,
  error,
}: Props) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s === currentStep)
  );

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div>
        <div className="text-muted-foreground mb-2 flex justify-between text-xs">
          <span>Analyzing video</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <Progress value={progress * 100} />
      </div>

      <ul className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const done = i < currentIndex || progress >= 1;
          const active = i === currentIndex && progress < 1;
          return (
            <li
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-foreground"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
              key={step}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                {done ? (
                  <Check className="text-primary h-5 w-5" />
                ) : active ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="border-muted-foreground/40 h-2 w-2 rounded-full border" />
                )}
              </span>
              <span>{step}</span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
