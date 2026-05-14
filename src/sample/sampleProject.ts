import type { Project } from "../types/project";
import { newId } from "../utils/id";
import { DEFAULT_PRESET } from "../constants/presets";
import { DEFAULT_FONT } from "../constants/fonts";
import { PALETTE } from "../engine/palette";

/**
 * Hardcoded starting project. Used by subsequent phases so they have
 * something to render against before the editor/persistence is wired.
 */
export function makeSampleProject(): Project {
  const text = "Welcome to reactimate.";

  // Welcome → componentized (chars 0..7)
  // reactimate → componentized (chars 11..21)
  const welcome = {
    id: newId("comp"),
    startIndex: 0,
    endIndex: 7,
    color: PALETTE[0],
    style: {
      fontFamily: DEFAULT_FONT.family,
      fontSize: 96,
      fontWeight: 800,
      color: "#fafafa",
      letterSpacing: -2,
      alignment: "center" as const,
      x: 0,
      y: 0,
      opacity: 0,
      scale: 1,
      rotation: 0,
      blur: 0,
    },
    effects: [
      {
        id: newId("fx"),
        type: "fade" as const,
        startTime: 0.1,
        duration: 0.6,
        easing: "ease-out" as const,
        targets: { opacity: 1 },
      },
    ],
  };

  const product = {
    id: newId("comp"),
    startIndex: 11,
    endIndex: 21,
    color: PALETTE[1],
    style: {
      fontFamily: DEFAULT_FONT.family,
      fontSize: 96,
      fontWeight: 800,
      color: "hsl(25, 90%, 60%)",
      letterSpacing: -2,
      alignment: "center" as const,
      x: 0,
      y: 20,
      opacity: 0,
      scale: 0.9,
      rotation: 0,
      blur: 0,
    },
    effects: [
      {
        id: newId("fx"),
        type: "slide" as const,
        startTime: 0.7,
        duration: 0.6,
        easing: "ease-out" as const,
        targets: { opacity: 1, y: 0, scale: 1 },
      },
    ],
  };

  return {
    id: newId("proj"),
    name: "Untitled hero",
    duration: 3,
    canvas: {
      preset: DEFAULT_PRESET.preset,
      width: DEFAULT_PRESET.width,
      height: DEFAULT_PRESET.height,
      background: "#0a0a0a",
    },
    defaultTextStyle: {
      fontFamily: DEFAULT_FONT.family,
      fontSize: 96,
      color: "#fafafa",
      fontWeight: 800,
    },
    layer: {
      id: newId("layer"),
      text,
      components: [welcome, product],
      alignment: "center",
      lineHeight: 1.1,
    },
  };
}
