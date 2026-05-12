export const PALETTE: readonly string[] = [
  "hsl(210, 80%, 60%)", // blue
  "hsl(25, 90%, 60%)", // orange
  "hsl(150, 60%, 50%)", // green
  "hsl(280, 70%, 65%)", // purple
  "hsl(340, 80%, 60%)", // pink
  "hsl(50, 90%, 55%)", // yellow
  "hsl(190, 75%, 55%)", // cyan
  "hsl(15, 70%, 55%)", // red-orange
];

export function nextColor(usedColors: readonly string[]): string {
  for (const c of PALETTE) {
    if (!usedColors.includes(c)) return c;
  }
  return PALETTE[usedColors.length % PALETTE.length];
}
