"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type Actor = {
  id: string;
  role: string;
  gender: string;
  ageRange: string;
  ethnicity?: string;
  styleDescription: string;
  appearanceTimeRanges: { start: number; end: number }[];
  screenTimePct: number;
  energyLevel: number;
  trustworthiness: number;
  eyeContactShare: number;
  cameraTreatment: string;
};

type PeopleAnalysis = {
  countMax: number;
  countAvg: number;
  overallGenderMix: { male: number; female: number; other: number };
  actors: Actor[];
};

type Props = {
  peopleAnalysis: PeopleAnalysis;
};

const ROLE_COLORS: Record<string, string> = {
  presenter: "#6366f1",
  "ugc-creator": "#f59e0b",
  testimonial: "#14b8a6",
  expert: "#3b82f6",
  "actor-silent": "#8b5cf6",
  crowd: "#64748b",
  "voiceover-only": "#0ea5e9",
  other: "#64748b",
};

const GENDER_COLORS: Record<string, string> = {
  male: "#3b82f6",
  female: "#ec4899",
  "non-binary": "#a855f7",
  unclear: "#64748b",
};

const GRADIENT_BG: string[] = [
  "from-indigo-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-teal-500 to-cyan-600",
  "from-pink-500 to-rose-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
];

function MiniBar({
  label,
  value,
  max = 10,
  color = "#6366f1",
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {max === 10 ? `${value.toFixed(1)}/10` : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="bg-muted h-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
      style={{ background: color ?? "#64748b" }}
    >
      {label}
    </span>
  );
}

function GenderMixBar({
  mix,
}: {
  mix: { male: number; female: number; other: number };
}) {
  const total = mix.male + mix.female + mix.other;
  if (total === 0) return null;
  const malePct = (mix.male / total) * 100;
  const femalePct = (mix.female / total) * 100;
  const otherPct = (mix.other / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Gender mix
        <InfoTooltip metricKey="genderMix" side="top" />
      </div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {malePct > 0 && (
          <div
            className="h-full"
            style={{ width: `${malePct}%`, background: GENDER_COLORS.male }}
            title={`Male ${Math.round(malePct)}%`}
          />
        )}
        {femalePct > 0 && (
          <div
            className="h-full"
            style={{
              width: `${femalePct}%`,
              background: GENDER_COLORS.female,
            }}
            title={`Female ${Math.round(femalePct)}%`}
          />
        )}
        {otherPct > 0 && (
          <div
            className="h-full"
            style={{ width: `${otherPct}%`, background: GENDER_COLORS.other }}
            title={`Other ${Math.round(otherPct)}%`}
          />
        )}
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        {malePct > 0 && <span>Male {Math.round(malePct)}%</span>}
        {femalePct > 0 && <span>Female {Math.round(femalePct)}%</span>}
        {otherPct > 0 && <span>Other {Math.round(otherPct)}%</span>}
      </div>
    </div>
  );
}

function ActorCard({ actor, index }: { actor: Actor; index: number }) {
  const initial = actor.id.length > 0 ? actor.id[0].toUpperCase() : "?";
  const gradientClass = GRADIENT_BG[index % GRADIENT_BG.length];

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} text-white font-bold text-sm`}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold">{actor.id}</span>
            <Pill label={actor.role} color={ROLE_COLORS[actor.role]} />
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: GENDER_COLORS[actor.gender] ?? "#64748b",
              }}
              title={actor.gender}
            />
            <span className="text-[10px] text-muted-foreground">
              {actor.ageRange}
            </span>
          </div>
          {actor.ethnicity && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {actor.ethnicity}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">
            {actor.styleDescription}
          </p>
        </div>
      </div>

      {/* Screen time bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Screen time</span>
          <span className="tabular-nums font-medium">
            {Math.round(actor.screenTimePct * 100)}%
          </span>
        </div>
        <div className="bg-muted h-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${Math.round(actor.screenTimePct * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniBar label="Energy" value={actor.energyLevel} color="#f59e0b" />
        <MiniBar
          label="Trustworthiness"
          value={actor.trustworthiness}
          color="#14b8a6"
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Eye contact</span>
        <span className="font-medium tabular-nums">
          {Math.round(actor.eyeContactShare * 100)}%
        </span>
      </div>

      <div className="text-[10px] text-muted-foreground">
        Cam:{" "}
        <span className="text-foreground font-medium">
          {actor.cameraTreatment}
        </span>
      </div>
    </div>
  );
}

export function PeopleAnalysisCard({ peopleAnalysis }: Props) {
  if (!peopleAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">People Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No people analysis available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { countMax, countAvg, overallGenderMix, actors } = peopleAnalysis;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">People Analysis</CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              Max on screen:{" "}
              <strong className="text-foreground">{countMax}</strong>
              <InfoTooltip metricKey="peopleCountMax" side="bottom" />
            </span>
            <span className="flex items-center gap-1">
              Avg:{" "}
              <strong className="text-foreground">{countAvg.toFixed(1)}</strong>
              <InfoTooltip metricKey="peopleCountAvg" side="bottom" />
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Ethics disclaimer — surfaces uncertainty on demographic inferences */}
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">AI estimates — not verified.</span>{" "}
            Gender, age range, and ethnicity below are inferred by an AI model
            from video content. Estimates carry meaningful error rates, may
            reflect training biases, and should never be used for targeting
            enforcement, casting decisions, or any other high-stakes use
            without explicit human verification.
          </div>
        </div>

        {/* Gender mix bar */}
        <GenderMixBar mix={overallGenderMix} />

        {/* Actor grid */}
        {actors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actors detected.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actors.map((actor, i) => (
              <ActorCard actor={actor} index={i} key={actor.id} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
