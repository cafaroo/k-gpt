"use client";

import { Brain, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (modelId: string) => void;
};

const CHAT_MODELS = [
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude",
    description: "Great for dialogue",
    icon: MessageCircle,
  },
  {
    id: "alibaba/qwen3-vl-thinking",
    name: "Qwen",
    description: "Deep reasoning",
    icon: Brain,
  },
] as const;

export function ModelSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      {CHAT_MODELS.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;
        return (
          <Button
            className="h-7 px-2 text-xs"
            key={m.id}
            onClick={() => onChange(m.id)}
            size="sm"
            type="button"
            variant={active ? "default" : "ghost"}
          >
            <Icon className="mr-1 h-3 w-3" />
            {m.name}
          </Button>
        );
      })}
    </div>
  );
}
