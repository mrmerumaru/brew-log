// Shared design tokens, lifted out of the original mockup so the form, the
// history list, and the login screen all read from one palette.
// Fonts are loaded via <link> in index.html.

// Type scale. Four steps, set two notches larger than the interface strictly
// needs — the app is used one-handed at a kitchen counter, often with a phone
// propped against something, and generous type is the main thing that makes it
// readable at arm's length:
//   12  labels and micro-copy
//   14  dense secondary values, small controls
//   16  body: inputs, prose, section headings, chips
//   18  titles
// Sizes live in the markup as literals because Tailwind can't take a dynamic
// class name; this comment is the scale's definition.

export const TOKENS = {
  paper: "#F3F1EC",
  card: "#FBFAF7",
  // Softened from near-black: at 16px on warm paper, full-strength ink reads
  // as harsh rather than crisp. Still comfortably past the contrast floor.
  ink: "#2B2621",
  inkFaint: "#78715F",
  rule: "#E0DACC",
  green: "#2F5233",
  greenSoft: "#E4EADF",
  amber: "#C77D2E",
  red: "#9B3B26",
  // Hover shade for the solid green buttons.
  greenDeep: "#26421F",
};

/**
 * Publish the palette as CSS custom properties so stylesheets can drive
 * hover/focus/pressed states without duplicating the hex values. TOKENS stays
 * the single source of truth — the canvas share card needs them as JS anyway,
 * and a second copy in CSS would drift.
 *
 * Called once from main.jsx before the first render.
 */
export function applyTokens(root = document.documentElement) {
  for (const [name, value] of Object.entries(TOKENS)) {
    root.style.setProperty(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  }
}

export const SANS = "'Space Grotesk', sans-serif";
export const MONO = "'IBM Plex Mono', monospace";
export const SERIF = "'Source Serif 4', serif";

// Starting suggestions for the drink field. Not a closed list — it's a free
// text input, and anything you type joins the suggestions next time.
export const DRINKS = [
  "Espresso",
  "Americano",
  "Iced Americano",
  "Long Black",
  "Latte",
  "Iced Latte",
  "Flat White",
  "Cappuccino",
  "Cortado",
  "Piccolo",
  "Macchiato",
  "Mocha",
  "Black Coffee",
  "Iced Coffee",
  "Affogato",
];

// Grinders use incompatible scales, so the unit travels with the number.
// Free text with these as suggestions — set once per grinder, then carried
// forward automatically.
export const GRIND_UNITS = ["clicks", "numbers", "rotations", "microns", "marks", "steps"];

// Starter suggestions for milk kind; like DRINKS, not a closed list.
export const MILK_TYPES = [
  "Fresh Milk",
  "Full Cream",
  "Low Fat",
  "Skim",
  "UHT",
  "Lactose Free",
  "Oat",
  "Almond",
  "Soy",
  "Coconut",
];

export const METHODS = [
  "Pourover",
  "Moka Pot",
  "Espresso",
  "Turkish",
  "French Press",
  "AeroPress",
  "Cold Brew",
];

// Deselectable in the form, so "not recorded" is still expressible.
export const BEAN_TYPES = ["Single Origin", "Blend"];

export const PROCESSES = ["Washed", "Natural", "Honey", "Anaerobic"];
export const ROASTS = ["Light", "Medium", "Dark"];
export const FLAVORS = [
  "Fruity",
  "Nutty",
  "Chocolatey",
  "Floral",
  "Acidic",
  "Bitter",
  "Sweet",
  "Earthy",
];

export const PHOTO_BUCKET = "brew-photos";
