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
  { family: "Poppins", label: "Poppins", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Montserrat", label: "Montserrat", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Nunito", label: "Nunito", weights: [400, 600, 700, 800, 900], category: "sans" },
  { family: "Work Sans", label: "Work Sans", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Lato", label: "Lato", weights: [400, 700, 900], category: "sans" },
  { family: "IBM Plex Sans", label: "IBM Plex Sans", weights: [400, 500, 600, 700], category: "sans" },
  // Serif
  { family: "Fraunces", label: "Fraunces", weights: [400, 600, 700, 900], category: "serif" },
  { family: "Playfair Display", label: "Playfair Display", weights: [400, 600, 700, 800, 900], category: "serif" },
  { family: "Lora", label: "Lora", weights: [400, 500, 600, 700], category: "serif" },
  { family: "EB Garamond", label: "EB Garamond", weights: [400, 500, 600, 700, 800], category: "serif" },
  { family: "Merriweather", label: "Merriweather", weights: [400, 700, 900], category: "serif" },
  { family: "Roboto Slab", label: "Roboto Slab", weights: [400, 500, 700, 900], category: "serif" },
  { family: "Crimson Pro", label: "Crimson Pro", weights: [400, 500, 600, 700, 800], category: "serif" },
  { family: "Cormorant Garamond", label: "Cormorant Garamond", weights: [400, 500, 600, 700], category: "serif" },
  { family: "Libre Baskerville", label: "Libre Baskerville", weights: [400, 700], category: "serif" },
  { family: "PT Serif", label: "PT Serif", weights: [400, 700], category: "serif" },
  // Display
  { family: "Bebas Neue", label: "Bebas Neue", weights: [400], category: "display" },
  { family: "Oswald", label: "Oswald", weights: [400, 500, 600, 700], category: "display" },
  { family: "Anton", label: "Anton", weights: [400], category: "display" },
  { family: "Archivo Black", label: "Archivo Black", weights: [400], category: "display" },
  { family: "Abril Fatface", label: "Abril Fatface", weights: [400], category: "display" },
  { family: "Lobster", label: "Lobster", weights: [400], category: "display" },
  { family: "Bungee", label: "Bungee", weights: [400], category: "display" },
  { family: "Monoton", label: "Monoton", weights: [400], category: "display" },
  { family: "Righteous", label: "Righteous", weights: [400], category: "display" },
  { family: "Alfa Slab One", label: "Alfa Slab One", weights: [400], category: "display" },
  { family: "Cinzel", label: "Cinzel", weights: [400, 500, 600, 700, 800, 900], category: "display" },
  // Handwriting / script
  { family: "Caveat", label: "Caveat", weights: [400, 500, 600, 700], category: "handwriting" },
  { family: "Pacifico", label: "Pacifico", weights: [400], category: "handwriting" },
  { family: "Dancing Script", label: "Dancing Script", weights: [400, 500, 600, 700], category: "handwriting" },
  { family: "Great Vibes", label: "Great Vibes", weights: [400], category: "handwriting" },
  { family: "Permanent Marker", label: "Permanent Marker", weights: [400], category: "handwriting" },
  { family: "Shadows Into Light", label: "Shadows Into Light", weights: [400], category: "handwriting" },
  { family: "Sacramento", label: "Sacramento", weights: [400], category: "handwriting" },
  // Mono
  { family: "JetBrains Mono", label: "JetBrains Mono", weights: [400, 500, 700], category: "mono" },
  { family: "Geist Mono", label: "Geist Mono", weights: [400, 500, 600, 700], category: "mono" },
  { family: "Fira Code", label: "Fira Code", weights: [400, 500, 600, 700], category: "mono" },
  { family: "IBM Plex Mono", label: "IBM Plex Mono", weights: [400, 500, 600, 700], category: "mono" },
  { family: "Space Mono", label: "Space Mono", weights: [400, 700], category: "mono" },
];

export const CATEGORY_LABEL: Record<FontOption["category"], string> = {
  sans: "Sans-serif",
  serif: "Serif",
  display: "Display",
  handwriting: "Handwriting",
  mono: "Monospace",
};

export const DEFAULT_FONT = FONTS[0];
