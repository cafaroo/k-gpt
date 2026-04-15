"use client";

import { Button } from "@/components/ui/button";

const QUESTIONS = [
  "Why does the hook work (or not) in the first 3 seconds?",
  "How is the pacing? Any dead spots?",
  "What does the audio dynamics tell us?",
  "Where is the CTA and could it land better?",
] as const;

type Props = {
  onPick: (q: string) => void;
};

export function SuggestedQuestions({ onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUESTIONS.map((q) => (
        <Button
          className="h-auto whitespace-normal py-2 text-left text-xs"
          key={q}
          onClick={() => onPick(q)}
          size="sm"
          variant="outline"
        >
          {q}
        </Button>
      ))}
    </div>
  );
}
