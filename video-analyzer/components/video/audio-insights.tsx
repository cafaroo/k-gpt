"use client";

import { Mic, Music, Volume2, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AudioAnalysis } from "@/lib/video/audio-schema";

type Props = {
  audio: AudioAnalysis;
  onSeek?: (time: number) => void;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SentimentBadge({ value }: { value: string }) {
  const color =
    value === "very-positive" || value === "positive"
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
      : value === "negative" || value === "very-negative"
        ? "bg-red-500/15 text-red-600 border-red-500/30"
        : value === "mixed"
          ? "bg-purple-500/15 text-purple-600 border-purple-500/30"
          : "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
    >
      {value}
    </span>
  );
}

export function AudioInsights({ audio, onSeek }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Waves className="text-primary h-4 w-4" />
          Audio insights
          <SentimentBadge value={audio.sentiment.overall} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {audio.summary}
        </p>

        {/* Music + Voice grid */}
        <div className="grid gap-3 md:grid-cols-2">
          {/* Music */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Music className="h-3.5 w-3.5" />
              Music
            </div>
            {audio.music.present ? (
              <div className="space-y-1">
                <Stat label="Genre" value={audio.music.genre} />
                <Stat label="Mood" value={audio.music.mood} />
                <Stat label="Energy" value={`${audio.music.energy}/10`} />
                {audio.music.bpmEstimate !== null && (
                  <Stat label="BPM" value={audio.music.bpmEstimate} />
                )}
                {audio.music.tempo && (
                  <Stat label="Tempo" value={audio.music.tempo} />
                )}
                <Stat
                  label="Has vocals"
                  value={audio.music.vocalsInMusic ? "yes" : "no"}
                />
                <Stat
                  label="Trending sound"
                  value={audio.music.trendingSoundLikely ? "likely" : "no"}
                />
                {audio.music.descriptors.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {audio.music.descriptors.map((d) => (
                      <span
                        className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px]"
                        key={d}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No music detected</p>
            )}
          </div>

          {/* Voiceover */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Mic className="h-3.5 w-3.5" />
              Voiceover
            </div>
            {audio.voiceover.present ? (
              <div className="space-y-1">
                <Stat label="Speakers" value={audio.voiceover.speakerCount} />
                {audio.voiceover.gender && (
                  <Stat label="Voice" value={audio.voiceover.gender} />
                )}
                <Stat label="Tone" value={audio.voiceover.tone} />
                <Stat label="Pace" value={audio.voiceover.pace} />
                <Stat
                  label="Clarity"
                  value={`${audio.voiceover.clarity}/10`}
                />
                <Stat
                  label="Articulation"
                  value={`${audio.voiceover.articulation}/10`}
                />
                {audio.voiceover.accent && (
                  <Stat label="Accent" value={audio.voiceover.accent} />
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                No voiceover detected
              </p>
            )}
          </div>
        </div>

        {/* Transcript */}
        {audio.voiceover.present && audio.voiceover.transcript && (
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              Transcript
            </div>
            <p className="bg-muted/30 max-h-40 overflow-y-auto rounded-md border p-2 text-xs leading-relaxed">
              {audio.voiceover.transcript}
            </p>
          </div>
        )}

        {/* Key quotes */}
        {audio.voiceover.keyQuotes.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              Key quotes
            </div>
            <div className="space-y-1.5">
              {audio.voiceover.keyQuotes.map((q) => (
                <button
                  className="flex w-full items-baseline gap-2 rounded border-l-2 border-primary/60 bg-muted/30 px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                  key={`${q.time}-${q.text}`}
                  onClick={() => onSeek?.(q.time)}
                  type="button"
                >
                  <span className="text-muted-foreground shrink-0 font-mono">
                    {q.time.toFixed(1)}s
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="italic">"{q.text}"</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      {q.why}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Events */}
        {audio.events.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              Audio events ({audio.events.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {audio.events.map((e) => (
                <button
                  className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-muted/70"
                  key={`${e.time}-${e.type}`}
                  onClick={() => onSeek?.(e.time)}
                  title={e.description}
                  type="button"
                >
                  {e.time.toFixed(1)}s · {e.type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sound design */}
        <div className="border-t pt-3">
          <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <Volume2 className="h-3.5 w-3.5" />
            Sound design
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Stat label="SFX count" value={audio.soundDesign.sfxCount} />
            <Stat
              label="Mix quality"
              value={`${audio.soundDesign.mixQuality}/10`}
            />
            <Stat label="A/V sync" value={audio.soundDesign.audioVisualSync} />
            <Stat
              label="Transition SFX"
              value={audio.soundDesign.usesTransitionSfx ? "yes" : "no"}
            />
            <Stat
              label="Emphasis SFX"
              value={audio.soundDesign.usesEmphasisSfx ? "yes" : "no"}
            />
            <Stat
              label="Silence use"
              value={
                audio.soundDesign.silenceUsedIntentionally
                  ? "intentional"
                  : "no"
              }
            />
          </div>
          {audio.soundDesign.notes && (
            <p className="text-muted-foreground mt-2 text-xs italic leading-relaxed">
              {audio.soundDesign.notes}
            </p>
          )}
        </div>

        {/* Ad suitability */}
        <div className="border-t pt-3">
          <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            Ad suitability
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Stat
              label="Hook audio"
              value={`${audio.adSuitability.hookAudioStrength}/10`}
            />
            <Stat
              label="Retention aid"
              value={`${audio.adSuitability.retentionAidScore}/10`}
            />
            <Stat
              label="Mobile-friendly"
              value={audio.adSuitability.mobileFirstFriendly ? "yes" : "no"}
            />
            <Stat
              label="Captions advised"
              value={audio.adSuitability.captionsRecommended ? "yes" : "no"}
            />
          </div>
          {audio.adSuitability.issues.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-red-500">Issues:</span>
              <ul className="text-muted-foreground ml-5 mt-0.5 list-disc text-xs">
                {audio.adSuitability.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          {audio.adSuitability.recommendations.length > 0 && (
            <div className="mt-2">
              <span className="text-primary text-xs font-medium">Fix:</span>
              <ul className="text-muted-foreground ml-5 mt-0.5 list-disc text-xs">
                {audio.adSuitability.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
