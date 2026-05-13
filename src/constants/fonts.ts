export interface FontOption {
  family: string;
  label: string;
  weights: readonly number[];
  category: "sans" | "serif" | "display" | "mono" | "handwriting";
}

export const FONTS: readonly FontOption[] = [
  // Sans
  { family: "Inter", label: "Inter", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Geist", label: "Geist", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Manrope", label: "Manrope", weights: [400, 500, 600, 700, 800], category: "sans" },
  { family: "Space Grotesk", label: "Space Grotesk", weights: [400, 500, 700], category: "sans" },
  { family: "Plus Jakarta Sans", label: "Plus Jakarta Sans", weights: [400, 600, 700, 800], category: "sans" },
  { family: "Outfit", label: "Outfit", weights: [400, 600, 700, 800, 900], category: "sans" },
  { family: "DM Sans", label: "DM Sans", weights: [400, 500, 700], category: "sans" },
  { family: "Karla", label: "Karla", weights: [400, 500, 700, 800], category: "sans" },
  { family: "Sora", label: "Sora", weights: [400, 500, 600, 700, 800], category: "sans" },
  { family: "Onest", label: "Onest", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Bricolage Grotesque", label: "Bricolage Grotesque", weights: [400, 600, 700, 800], category: "sans" },
  // Serif
  { family: "Fraunces", label: "Fraunces", weights: [400, 600, 700, 900], category: "serif" },
  { family: "Playfair Display", label: "Playfair Display", weights: [400, 600, 700, 800, 900], category: "serif" },
  { family: "Lora", label: "Lora", weights: [400, 500, 600, 700], category: "serif" },
  { family: "EB Garamond", label: "EB Garamond", weights: [400, 500, 600, 700, 800], category: "serif" },
  { family: "Merriweather", label: "Merriweather", weights: [400, 700, 900], category: "serif" },
  { family: "Roboto Slab", label: "Roboto Slab", weights: [400, 500, 700, 900], category: "serif" },
  // Display
  { family: "Bebas Neue", label: "Bebas Neue", weights: [400], category: "display" },
  { family: "Oswald", label: "Oswald", weights: [400, 500, 600, 700], category: "display" },
  { family: "Anton", label: "Anton", weights: [400], category: "display" },
  { family: "Archivo Black", label: "Archivo Black", weights: [400], category: "display" },
  // Handwriting / script
  { family: "Caveat", label: "Caveat", weights: [400, 500, 600, 700], category: "handwriting" },
  { family: "Pacifico", label: "Pacifico", weights: [400], category: "handwriting" },
  // Mono
  { family: "JetBrains Mono", label: "JetBrains Mono", weights: [400, 500, 700], category: "mono" },
  { family: "Geist Mono", label: "Geist Mono", weights: [400, 500, 600, 700], category: "mono" },
  { family: "Fira Code", label: "Fira Code", weights: [400, 500, 600, 700], category: "mono" },
];

export const CATEGORY_LABEL: Record<FontOption["category"], string> = {
  sans: "Sans-serif",
  serif: "Serif",
  display: "Display",
  handwriting: "Handwriting",
  mono: "Monospace",
};

export const DEFAULT_FONT = FONTS[0];
