import type { EffectType, Project } from "../../types/project";
import { makeSampleProject } from "../../sample/sampleProject";

/**
 * A read-only digest of someone else's project, for the admin Users page.
 *
 * The point is answering "did this person actually build anything?" without
 * opening their work — so it counts real authoring signals (their own text,
 * components they created, effects they configured) and flags the case where
 * a project doc exists purely because autosave pushed the untouched sample.
 */
export interface ProjectSummary {
  name: string;
  /** The hero text they typed, whitespace-collapsed for table display. */
  text: string;
  /** Characters of hero text. */
  textLength: number;
  componentCount: number;
  /** Effects across all components, EXCLUDING the `custom` "(no effect)" placeholders. */
  effectCount: number;
  /** Distinct real effect types used, in a stable order for display. */
  effectTypes: EffectType[];
  durationSeconds: number;
  canvas: string;
  /**
   * True when the text and component count still match the bundled sample —
   * i.e. the project was saved but never meaningfully edited. A user who
   * only opened the editor and left produces exactly this.
   */
  looksUntouched: boolean;
}

/** Effects the user never chose — emitted automatically to keep text visible. */
const PLACEHOLDER: EffectType = "custom";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export function summarizeProject(project: Project): ProjectSummary {
  const components = project.layer?.components ?? [];
  const realEffects = components.flatMap((c) =>
    (c.effects ?? []).filter((e) => e.type !== PLACEHOLDER),
  );

  const types: EffectType[] = [];
  for (const e of realEffects) {
    if (!types.includes(e.type)) types.push(e.type);
  }

  const text = project.layer?.text ?? "";
  const sample = makeSampleProject();
  const looksUntouched =
    collapse(text) === collapse(sample.layer.text) &&
    components.length === sample.layer.components.length;

  return {
    name: project.name ?? "",
    text: collapse(text),
    textLength: text.length,
    componentCount: components.length,
    effectCount: realEffects.length,
    effectTypes: types,
    durationSeconds: project.duration ?? 0,
    canvas: project.canvas
      ? `${project.canvas.width}×${project.canvas.height}`
      : "—",
    looksUntouched,
  };
}
