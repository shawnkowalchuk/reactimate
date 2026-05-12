/**
 * Render a JS value as the kind of source string a human would write
 * by hand. JSON.stringify is *almost* right but always quotes keys
 * and uses double quotes for strings — the result reads as data, not
 * code. This formatter:
 *   - quotes keys only when they aren't valid identifiers
 *   - uses double quotes for strings (idiomatic JSX defaults)
 *   - pretty-prints objects/arrays past a length threshold
 */
const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

interface FmtOptions {
  indent: string;
  maxInline: number;
}

const DEFAULT_OPTS: FmtOptions = {
  indent: "  ",
  maxInline: 60,
};

export function fmt(
  value: unknown,
  depth = 0,
  opts: FmtOptions = DEFAULT_OPTS,
): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(+value.toFixed(6));
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) return fmtArray(value, depth, opts);
  if (typeof value === "object") {
    return fmtObject(value as Record<string, unknown>, depth, opts);
  }
  return String(value);
}

function fmtArray(arr: unknown[], depth: number, opts: FmtOptions): string {
  if (arr.length === 0) return "[]";
  const inline = "[" + arr.map((v) => fmt(v, depth + 1, opts)).join(", ") + "]";
  if (inline.length <= opts.maxInline && !inline.includes("\n")) return inline;
  const pad = opts.indent.repeat(depth + 1);
  const close = opts.indent.repeat(depth);
  return (
    "[\n" +
    arr.map((v) => pad + fmt(v, depth + 1, opts)).join(",\n") +
    `,\n${close}]`
  );
}

function fmtObject(
  obj: Record<string, unknown>,
  depth: number,
  opts: FmtOptions,
): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";

  const kv = entries.map(([k, v]) => {
    const key = IDENT_RE.test(k) ? k : JSON.stringify(k);
    return [key, fmt(v, depth + 1, opts)] as const;
  });

  const inline = "{ " + kv.map(([k, v]) => `${k}: ${v}`).join(", ") + " }";
  if (inline.length <= opts.maxInline && !inline.includes("\n")) return inline;

  const pad = opts.indent.repeat(depth + 1);
  const close = opts.indent.repeat(depth);
  return (
    "{\n" +
    kv.map(([k, v]) => `${pad}${k}: ${v}`).join(",\n") +
    `,\n${close}}`
  );
}

/**
 * Escape text content for use inside JSX. We render text by splitting
 * raw runs out as `{"…"}` expressions so braces, angle brackets, and
 * quotes inside the source text can't break the JSX parser.
 */
export function jsxTextExpression(text: string): string {
  return `{${JSON.stringify(text)}}`;
}
