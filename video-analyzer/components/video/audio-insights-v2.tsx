"use client";

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  audioExtended: AnalysisExtended["audioExtended"];
  onSeek?: (time: number) => void;
};

export function AudioInsightsV2({ audioExtended, onSeek }: Props) {
  const {
    voiceoverTone,
    voiceoverPace,
    music,
    ambientSounds,
    soundEffects,
    silenceMoments,
    audioDensity,
  } = audioExtended;

  const energyData = music.energyCurve.map((pt) => ({
    t: pt.time,
    e: pt.energy,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Audio landscape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <span className="text-muted-foreground text-xs">Density:</span>
          <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
            {audioDensity}
          </span>
          {voiceoverPace && (
            <>
              <span className="text-muted-foreground text-xs">Pace:</span>
              <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                {voiceoverPace}
              </span>
            </>
          )}
        </div>

        {voiceoverTone.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1 text-xs">VO tone</div>
            <div className="flex flex-wrap gap-1">
              {voiceoverTone.map((t) => (
                <span
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                  key={t}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {music.present && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Music</span>
              <span className="text-muted-foreground text-xs">
                {[music.genre, music.mood].filter(Boolean).join(" · ") || "—"}
              </span>
            </div>
            {energyData.length > 0 && (
              <div style={{ width: "100%", height: 80, minWidth: 240 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart data={energyData}>
                    <defs>
                      <linearGradient
                        id="musicEnergy"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#a855f7"
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="100%"
                          stopColor="#a855f7"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="t"
                      fontSize={9}
                      tickFormatter={(v) => `${v.toFixed(0)}s`}
                    />
                    <YAxis domain={[0, 10]} fontSize={9} width={22} />
                    <Area
                      dataKey="e"
                      fill="url(#musicEnergy)"
                      isAnimationActive={false}
                      stroke="#a855f7"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {music.drops.length > 0 && (
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {music.drops.map((d) => (
                  <li key={`drop-${d.timestamp}-${d.effect.slice(0, 8)}`}>
                    <button
                      className="hover:text-foreground"
                      onClick={() => onSeek?.(d.timestamp)}
                      type="button"
                    >
                      {d.timestamp.toFixed(1)}s
                    </button>
                    {" — "}
                    {d.effect}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {ambientSounds.length > 0 && (
          <Section title="Ambient">
            {ambientSounds.map((a) => (
              <Row
                key={`amb-${a.start}-${a.description.slice(0, 16)}`}
                onClick={() => onSeek?.(a.start)}
                range={`${a.start.toFixed(1)}–${a.end.toFixed(1)}s`}
                tag={a.role}
                text={a.description}
              />
            ))}
          </Section>
        )}

        {soundEffects.length > 0 && (
          <Section title="SFX">
            {soundEffects.map((s) => (
              <Row
                key={`sfx-${s.timestamp}-${s.sfx}`}
                onClick={() => onSeek?.(s.timestamp)}
                range={`${s.timestamp.toFixed(1)}s`}
                tag={s.sfx}
                text={s.purpose}
              />
            ))}
          </Section>
        )}

        {silenceMoments.length > 0 && (
          <Section title="Silence">
            {silenceMoments.map((s) => (
              <Row
                key={`sil-${s.start}-${s.end}`}
                onClick={() => onSeek?.(s.start)}
                range={`${s.start.toFixed(1)}–${s.end.toFixed(1)}s`}
                text={s.impact}
              />
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  range,
  tag,
  text,
  onClick,
}: {
  range: string;
  tag?: string;
  text: string;
  onClick?: () => void;
}) {
  return (
    <div className="text-xs">
      <button
        className="text-muted-foreground hover:text-foreground mr-2 font-mono"
        onClick={onClick}
        type="button"
      >
        {range}
      </button>
      {tag && (
        <span className="bg-muted mr-2 rounded px-1 py-0.5 text-[10px]">
          {tag}
        </span>
      )}
      <span>{text}</span>
    </div>
  );
}
