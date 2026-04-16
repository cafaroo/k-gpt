/**
 * Converts a Zod schema into a JSON-like skeleton string suitable for
 * injecting into a prompt. The goal is to give Gemini an explicit shape
 * with type hints, enum values, and descriptions so it doesn't invent
 * its own field names.
 *
 * Output is *not* valid JSON — it uses `<placeholders>` and inline pipes
 * for enums. That's intentional: Gemini treats it as a spec, not an
 * example to copy.
 *
 * Example output:
 *   {
 *     "overall": {
 *       "score": <number 0-100>,                 // Overall ad quality 0-100
 *       "tagline": "<string>",                    // One-line summary
 *       "summary": "<string>"                     // 2-3 sentence executive summary
 *     },
 *     ...
 *   }
 */

import type { z } from "zod";

type AnyDef = {
  typeName?: string;
  description?: string;
  innerType?: unknown;
  defaultValue?: () => unknown;
  shape?: () => Record<string, unknown>;
  type?: unknown;
  values?: readonly string[] | Record<string, string | number>;
  options?: readonly unknown[];
  value?: unknown;
};

const INDENT = "  ";
const MAX_ENUM_DISPLAY = 12;

function getDef(node: unknown): AnyDef {
  if (node && typeof node === "object" && "_def" in node) {
    return (node as { _def: AnyDef })._def ?? {};
  }
  return {};
}

function describe(def: AnyDef, fallback?: string): string {
  const d = def.description?.trim();
  if (d) {
    return d;
  }
  return fallback ?? "";
}

function formatComment(text: string): string {
  if (!text) {
    return "";
  }
  const single = text.replace(/\s+/g, " ").trim();
  return `// ${single}`;
}

function renderEnumValues(values: readonly string[]): string {
  if (values.length <= MAX_ENUM_DISPLAY) {
    return values.map((v) => `"${v}"`).join(" | ");
  }
  const head = values
    .slice(0, MAX_ENUM_DISPLAY)
    .map((v) => `"${v}"`)
    .join(" | ");
  return `${head} | ... (${values.length - MAX_ENUM_DISPLAY} more)`;
}

function numberPlaceholder(key: string | undefined, desc: string): string {
  const k = (key ?? "").toLowerCase();
  const hints = `${k} ${desc}`.toLowerCase();

  // Time-typed keys take priority — duration/second/time/etc. never
  // mean "ratio" even if the description mentions fractions.
  if (
    /^(duration|seconds?|time|start|end|timestamp|resolves_?at|first_?glimpse_?at|full_?reveal_?at)$/.test(
      k
    ) ||
    /seconds until|per second|in seconds/.test(desc.toLowerCase())
  ) {
    return "<number seconds>";
  }

  // Overall.score is the one 0-100 exception.
  if (
    /0-100|0 to 100/.test(hints) ||
    (k === "score" && /overall/.test(hints))
  ) {
    return "<number 0-100>";
  }

  if (
    /score|intensity|clarity|strength|effectiveness|risk|stop.?power|tension|energy|likelihood|variety|nativeness|claim.?clarity|hold.?to.?3s/.test(
      hints
    )
  ) {
    return "<number 0-10>";
  }

  if (/ratio|confidence|fraction/.test(hints)) {
    return "<number 0-1>";
  }

  if (/per.?minute|cutsperminute/.test(hints)) {
    return "<number>";
  }
  return "<number>";
}

type Context = {
  key?: string;
  depth: number;
  optional?: boolean;
  nullable?: boolean;
};

function indent(depth: number): string {
  return INDENT.repeat(depth);
}

// Fields the server sets post-analysis — never ask Gemini to produce them.
const SERVER_FIELDS = new Set(["schemaVersion"]);

function renderObjectShape(
  shape: Record<string, unknown>,
  depth: number
): string {
  const entries = Object.entries(shape).filter(
    ([key]) => !SERVER_FIELDS.has(key)
  );
  if (entries.length === 0) {
    return "{}";
  }
  const lines: string[] = [];
  lines.push("{");
  entries.forEach(([key, child], idx) => {
    const childDef = getDef(child);
    const optional = childDef.typeName === "ZodOptional";
    const nullable = childDef.typeName === "ZodNullable";
    const unwrapped = optional || nullable ? childDef.innerType : child;

    const rendered = renderNode(unwrapped, {
      key,
      depth: depth + 1,
      optional,
      nullable,
    });
    const desc = describe(getDef(unwrapped), "");
    const markers: string[] = [];
    if (optional) {
      markers.push("optional");
    }
    if (nullable) {
      markers.push("nullable");
    }
    const markerText = markers.length > 0 ? `[${markers.join(", ")}] ` : "";
    const commentText = `${markerText}${desc}`.trim();
    const comment = commentText ? ` ${formatComment(commentText)}` : "";
    const comma = idx === entries.length - 1 ? "" : ",";
    lines.push(`${indent(depth + 1)}"${key}": ${rendered}${comma}${comment}`);
  });
  lines.push(`${indent(depth)}}`);
  return lines.join("\n");
}

function renderNode(node: unknown, ctx: Context): string {
  const def = getDef(node);
  const typeName = def.typeName;

  switch (typeName) {
    case "ZodObject": {
      const shape = def.shape ? def.shape() : {};
      return renderObjectShape(shape, ctx.depth);
    }
    case "ZodArray": {
      const inner = def.type;
      const innerRendered = renderNode(inner, { ...ctx, depth: ctx.depth + 1 });
      const innerDesc = describe(getDef(inner), "");
      const innerLines = innerRendered.split("\n");
      if (innerLines.length > 1) {
        return `[\n${indent(ctx.depth + 1)}${innerLines.join("\n")},\n${indent(
          ctx.depth + 1
        )}... (more items)\n${indent(ctx.depth)}]`;
      }
      const suffix = innerDesc ? ` ${formatComment(innerDesc)}` : "";
      return `[ ${innerRendered}, ...${suffix} ]`;
    }
    case "ZodEnum": {
      const values = (def.values ?? []) as readonly string[];
      return renderEnumValues(values);
    }
    case "ZodNativeEnum": {
      const values = def.values;
      if (Array.isArray(values)) {
        return renderEnumValues(values as readonly string[]);
      }
      if (values && typeof values === "object") {
        return renderEnumValues(
          Object.values(values).filter(
            (v): v is string => typeof v === "string"
          )
        );
      }
      return '"<enum>"';
    }
    case "ZodString":
      return '"<string>"';
    case "ZodNumber":
      return numberPlaceholder(ctx.key, describe(def, ""));
    case "ZodBoolean":
      return "<true | false>";
    case "ZodLiteral": {
      const v = def.value;
      if (typeof v === "string") {
        return `"${v}"`;
      }
      return String(v ?? "<literal>");
    }
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
    case "ZodReadonly":
    case "ZodBranded":
      return renderNode(def.innerType, ctx);
    case "ZodEffects": {
      const inner = (def as unknown as { schema?: unknown }).schema;
      return renderNode(inner, ctx);
    }
    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      const options = (def.options ?? []) as unknown[];
      if (options.length === 0) {
        return '"<any>"';
      }
      const first = options[0];
      return renderNode(first, ctx);
    }
    case "ZodAny":
    case "ZodUnknown":
      return '"<any>"';
    case "ZodNull":
      return "null";
    default:
      return '"<unknown>"';
  }
}

export function schemaToSkeleton(schema: z.ZodTypeAny): string {
  return renderNode(schema, { depth: 0 });
}
