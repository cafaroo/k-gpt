"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AudienceProfile = {
  primaryAgeRange: string;
  primaryGender: "male" | "female" | "balanced" | "other";
  socioeconomic: "budget" | "mainstream" | "aspirational" | "premium" | "luxury";
  urbanicity: "urban" | "suburban" | "rural" | "mixed";
  region?: string;
  lifestyleMarkers: string[];
  values: string[];
  pains: string[];
  desires: string[];
  purchaseReadiness: "awareness" | "consideration" | "decision" | "retention";
};

type Props = {
  audienceProfile: AudienceProfile;
};

const SOCIO_LABELS: Record<string, string> = {
  budget: "Budget",
  mainstream: "Mainstream",
  aspirational: "Aspirational",
  premium: "Premium",
  luxury: "Luxury",
};

const FUNNEL_STAGES: AudienceProfile["purchaseReadiness"][] = [
  "awareness",
  "consideration",
  "decision",
  "retention",
];

const FUNNEL_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#14b8a6",
  "#22c55e",
];

const GENDER_ICON: Record<string, string> = {
  male: "M",
  female: "F",
  balanced: "M/F",
  other: "–",
};

function Chip({ label, variant = "default" }: { label: string; variant?: "pain" | "desire" | "value" | "default" }) {
  const colors = {
    pain: "bg-red-500/10 text-red-600 border-red-200",
    desire: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    value: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
    default: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colors[variant]}`}
    >
      {label}
    </span>
  );
}

function ChipCloud({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "pain" | "desire" | "value";
}) {
  const titleColor = {
    pain: "text-red-600",
    desire: "text-emerald-600",
    value: "text-indigo-600",
  }[variant];

  return (
    <div className="space-y-2">
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${titleColor}`}>
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">None identified</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Chip key={i} label={item} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}

function PurchasePipeline({
  stage,
}: {
  stage: AudienceProfile["purchaseReadiness"];
}) {
  const activeIdx = FUNNEL_STAGES.indexOf(stage);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Purchase Readiness
      </div>
      <div className="flex items-center gap-1">
        {FUNNEL_STAGES.map((s, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          return (
            <div className="flex items-center gap-1 flex-1" key={s}>
              <div
                className="flex-1 rounded-full py-1.5 text-center text-[10px] font-medium transition-all"
                style={{
                  background: isActive
                    ? FUNNEL_COLORS[i]
                    : isPast
                      ? `${FUNNEL_COLORS[i]}50`
                      : undefined,
                  color: isActive ? "#fff" : isPast ? FUNNEL_COLORS[i] : undefined,
                  border: isActive
                    ? "none"
                    : `1px solid ${isPast ? FUNNEL_COLORS[i] : "#e2e8f0"}`,
                }}
              >
                {s}
              </div>
              {i < FUNNEL_STAGES.length - 1 && (
                <div
                  className="h-px w-2 shrink-0"
                  style={{
                    background: isPast ? FUNNEL_COLORS[i] : "#e2e8f0",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AudienceProfileCard({ audienceProfile }: Props) {
  if (!audienceProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No audience profile available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    primaryAgeRange,
    primaryGender,
    socioeconomic,
    urbanicity,
    region,
    lifestyleMarkers,
    values,
    pains,
    desires,
    purchaseReadiness,
  } = audienceProfile;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Audience Profile</CardTitle>
        {/* Primary demographics summary */}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium">
            <span className="text-muted-foreground">Age</span>
            <strong>{primaryAgeRange}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium">
            <span className="text-muted-foreground">Gender</span>
            <strong>{GENDER_ICON[primaryGender] ?? primaryGender}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium">
            <span className="text-muted-foreground">Socioeco.</span>
            <strong>{SOCIO_LABELS[socioeconomic] ?? socioeconomic}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium">
            <span className="text-muted-foreground">Location</span>
            <strong>{urbanicity}</strong>
          </span>
          {region && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium">
              <span className="text-muted-foreground">Region</span>
              <strong>{region}</strong>
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {/* Lifestyle markers */}
        {lifestyleMarkers.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lifestyle Markers
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lifestyleMarkers.map((m, i) => (
                <Chip key={i} label={m} />
              ))}
            </div>
          </div>
        )}

        {/* Three-column chip clouds */}
        <div className="grid gap-4 sm:grid-cols-3">
          <ChipCloud title="Values" items={values} variant="value" />
          <ChipCloud title="Pains" items={pains} variant="pain" />
          <ChipCloud title="Desires" items={desires} variant="desire" />
        </div>

        {/* Purchase readiness pipeline */}
        <PurchasePipeline stage={purchaseReadiness} />
      </CardContent>
    </Card>
  );
}
