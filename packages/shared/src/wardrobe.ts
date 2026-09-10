export interface WardrobeItem {
  id: string;
  label: string;
  slot: "coat" | "collar" | "mark" | "ring";
  currency: "tokens" | "diamonds";
  cost: number;
}

export const WARDROBE: WardrobeItem[] = [
  { id: "collar-linen", label: "Linen collar", slot: "collar", currency: "tokens", cost: 40 },
  { id: "collar-brass", label: "Brass collar", slot: "collar", currency: "tokens", cost: 90 },
  { id: "coat-slate", label: "Slate coat", slot: "coat", currency: "tokens", cost: 120 },
  { id: "coat-obsidian", label: "Obsidian coat", slot: "coat", currency: "diamonds", cost: 1 },
  { id: "mark-eclipse", label: "Eclipse mark", slot: "mark", currency: "tokens", cost: 60 },
  { id: "ring-quiet", label: "Quiet ring", slot: "ring", currency: "diamonds", cost: 1 },
];
