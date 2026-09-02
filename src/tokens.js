// Shared design tokens, lifted out of the original mockup so the form, the
// history list, and the login screen all read from one palette.
// Fonts are loaded via <link> in index.html.

export const TOKENS = {
  paper: "#F3F1EC",
  card: "#FBFAF7",
  ink: "#201D1A",
  inkFaint: "#6B6558",
  rule: "#D8D2C4",
  green: "#2F5233",
  greenSoft: "#E4EADF",
  amber: "#C77D2E",
  red: "#9B3B26",
};

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
