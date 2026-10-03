import {
  Atkinson_Hyperlegible,
  Big_Shoulders,
  Big_Shoulders_Stencil,
} from "next/font/google";

/**
 * The board's typefaces. Google renamed "Big Shoulders Display" to
 * "Big Shoulders" and "Big Shoulders Stencil Display" to "Big Shoulders
 * Stencil"; these are the same faces under their current names.
 *
 * Scoped to the board via the variable class names rather than loaded in the
 * root layout, so the rest of the app keeps Geist and pays nothing for these.
 */
export const boardUi = Atkinson_Hyperlegible({
  variable: "--font-board-ui",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const boardDisplay = Big_Shoulders({
  variable: "--font-board-display",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
});

export const boardStencil = Big_Shoulders_Stencil({
  variable: "--font-board-stencil",
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
});

export const boardFontClass = `${boardUi.variable} ${boardDisplay.variable} ${boardStencil.variable}`;
