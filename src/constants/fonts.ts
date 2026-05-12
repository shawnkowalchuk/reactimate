export interface FontOption {
  family: string;
  label: string;
  weights: readonly number[];
}

export const FONTS: readonly FontOption[] = [
  { family: "Inter", label: "Inter", weights: [400, 500, 600, 700, 800, 900] },
  { family: "Manrope", label: "Manrope", weights: [400, 500, 600, 700, 800] },
  { family: "Space Grotesk", label: "Space Grotesk", weights: [400, 500, 700] },
  { family: "Plus Jakarta Sans", label: "Plus Jakarta Sans", weights: [400, 600, 700, 800] },
  { family: "Outfit", label: "Outfit", weights: [400, 600, 700, 800, 900] },
  { family: "DM Sans", label: "DM Sans", weights: [400, 500, 700] },
  { family: "Fraunces", label: "Fraunces", weights: [400, 600, 700, 900] },
  { family: "Playfair Display", label: "Playfair Display", weights: [400, 600, 700, 800, 900] },
  { family: "Bricolage Grotesque", label: "Bricolage Grotesque", weights: [400, 600, 700, 800] },
  { family: "JetBrains Mono", label: "JetBrains Mono", weights: [400, 500, 700] },
];

export const DEFAULT_FONT = FONTS[0];
