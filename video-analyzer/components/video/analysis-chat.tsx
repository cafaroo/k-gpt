"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Loader2 } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type {
  ExtractedFrame,
  PerformanceData,
  VideoExtraction,
} from "@/lib/video/types";
import { SuggestedQuestions } from "./suggested-questions";

type Props = {
  extraction: VideoExtraction;
  performance: PerformanceData;
};

function pickKeyframes(frames: ExtractedFrame[], count = 8): ExtractedFrame[] {
  if (frames.length <= count) return frames;
  const step = frames.length / count;
  const out: ExtractedFrame[] = [];
  for (let i = 0; i < count; i++) {
    out.push(frames[Math.floor(i * step)]);
  }
  return out;
}

function stripExtraction(extraction: VideoExtraction): VideoExtraction {
  return {
    ...extraction,
    frames: extraction.frames.map((f) => ({
      timestamp: f.timestamp,
      brightness: f.brightness,
      dominantColor: f.dominantColor,
      dataUrl: "",
    })),
  };
}

export function AnalysisChat({ extraction, performance }: Props) {
  const contextRef = useRef({
    extraction: stripExtraction(extraction),
    performance,
  });
  contextRef.current = {
    extraction: stripExtraction(extraction),
    performance,
  };

  const keyframes = useMemo(
    () => pickKeyframes(extraction.frames, 8),
    [extraction.frames]
  );
  const firstSendRef = useRef(true);

  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/analyze/api/chat",
      prepareSendMessagesRequest({ messages: msgs }) {
        return {
          body: {
            messages: msgs,
            videoContext: contextRef.current,
          },
        };
      },
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    const parts: UIMessage["parts"] = [{ type: "text", text: trimmed }];
    if (firstSendRef.current) {
      firstSendRef.current = false;
      for (const f of keyframes) {
        parts.push({
          type: "file",
          mediaType: "image/jpeg",
          url: f.dataUrl,
        } as UIMessage["parts"][number]);
      }
    }
    sendMessage({ role: "user", parts });
    setInput("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 py-6">
            <p className="text-muted-foreground text-sm">
              Ask Claude Sonnet 4.5 about this video. Keyframes are sent with
              your first message.
            </p>
            <SuggestedQuestions onPick={submit} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div
                className={
                  m.role === "user"
                    ? "bg-primary/10 ml-auto max-w-[85%] rounded-lg px-3 py-2 text-sm"
                    : "bg-muted/40 max-w-[85%] rounded-lg px-3 py-2 text-sm"
                }
                key={m.id}
              >
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    return (
                      <p
                        className="whitespace-pre-wrap leading-relaxed"
                        key={i}
                      >
                        {p.text}
                      </p>
                    );
                  }
                  if (p.type === "file") {
                    return (
                      <span
                        className="text-muted-foreground block text-[10px]"
                        key={i}
                      >
                        [image attached]
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
            {isStreaming && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Claude is analyzing…
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <form className="bg-background border-t p-3" onSubmit={onSubmit}>
        <div className="flex items-end gap-2">
          <Textarea
            className="resize-none"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Ask about the video…"
            rows={2}
            value={input}
          />
          {isStreaming ? (
            <Button onClick={() => stop()} size="icon" type="button">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button disabled={!input.trim()} size="icon" type="submit">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
