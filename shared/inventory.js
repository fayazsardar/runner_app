export const items = [
  {
    id: "wash",
    name: "Hand wash liquid",
    group: "Chemicals",
    unit: "L",
    step: 0.5,
    min: 3,
  },
  {
    id: "napkins",
    name: "Napkins",
    group: "Paper supplies",
    unit: "packs",
    step: 1,
  },
  {
    id: "toilet",
    name: "Toilet paper",
    group: "Paper supplies",
    unit: "rolls",
    step: 1,
    min: 8,
  },
  {
    id: "paper",
    name: "Paper hand towels",
    group: "Paper supplies",
    unit: "packs",
    step: 1,
  },
  {
    id: "towels",
    name: "Hand towels",
    group: "Linen",
    unit: "pieces",
    step: 1,
  },
  {
    id: "square",
    name: "Tablecloth · 70 × 70",
    group: "Linen",
    unit: "pieces",
    step: 1,
  },
  {
    id: "small",
    name: "Tablecloth · 63",
    group: "Linen",
    unit: "pieces",
    step: 1,
  },
  {
    id: "long",
    name: "Tablecloth · 70 × 90",
    group: "Linen",
    unit: "pieces",
    step: 1,
  },
];

export const groups = ["Chemicals", "Paper supplies", "Linen"];
export const linen = items.filter((item) => item.group === "Linen");
export const lowStock = (stock) =>
  items.filter((item) => item.min && stock[item.id] < item.min);

export function initialState(demo = false) {
  const examples = [2.5, 12, 6, 3, 18, 48, 30, 36];
  return {
    revision: 0,
    updated: null,
    receipt: null,
    stock: Object.fromEntries(
      items.map((item, i) => [item.id, demo ? examples[i] : 0]),
    ),
    laundry: Object.fromEntries(
      linen.map((item, i) => [item.id, demo ? [6, 8, 4, 8][i] : 0]),
    ),
  };
}

// Calendar arithmetic on the venue's date also works across DST and year boundaries.
export function nextDate(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day") + 1))
    .toISOString()
    .slice(0, 10);
}
