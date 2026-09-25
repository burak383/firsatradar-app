export const colors = {
  background: "#0B0F17",
  foreground: "#F4F7FB",
  primary: "#FF6B00",
  primaryForeground: "#0B0F17",
  secondary: "#1B2534",
  secondaryForeground: "#E8EDF5",
  accent: "#72F3A1",
  accentForeground: "#082015",
  muted: "#141C28",
  mutedForeground: "#9AA8BB",
  card: "#111925",
  cardForeground: "#F4F7FB",
  border: "#263247",
  input: "#172131",
  destructive: "#FF5C6C",
  destructiveForeground: "#26070C",
  success: "#72F3A1",
  successForeground: "#082015",
  chart1: "#FF6B00",
  chart2: "#72F3A1",
  chart3: "#3BB9FF",
  chart4: "#B18CFF",
  chart5: "#FFD166",
} as const;

export const fonts = {
  heading: "Space Grotesk",
  body: "Inter",
} as const;

// Ekranların bir kismi `import { theme } from './theme'` (named) ile,
// bir kismi `import theme from './theme'` (default) ile, bir kismi de
// `import { colors, fonts } from './theme'` ile bu dosyayi kullaniyor.
// Ucunu de tek bir kaynaktan besleyecek sekilde hepsini export ediyoruz.
export const theme = {
  colors,
  fonts,
  cornerRadius: 16,
} as const;

export default theme;

// Geriye donuk uyumluluk (ilk surumde buyuk harfle export edilmisti)
export const Colors = colors;
export const Fonts = fonts;
export const Theme = { cornerRadius: theme.cornerRadius } as const;
