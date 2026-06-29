/**
 * onboarding/data.ts — restriction taxonomy for the onboarding picker.
 * Domain DATA (not UI chrome): each entry has a contract-style `code`
 * (matches DietaryRestriction.code, e.g. "allergy:shrimp") + a reader-language
 * label. Replaced by a server-driven catalog later.
 *
 * NOTE (deviation): the mockup A4 lists allergens in Korean (place language).
 * For the MVP English reader we show English labels — Constitution I/II
 * (reader text in reader language). Codes stay stable/English.
 */
import type { RestrictionKind } from '@/lib/api/types';

export interface RestrictionOption {
  code: string;
  label: string;
  kind: RestrictionKind;
}

export interface RestrictionGroup {
  label: string; // group heading (reader language)
  kind: RestrictionKind;
  items: RestrictionOption[];
}

const allergy = (label: string, slug: string): RestrictionOption => ({
  code: `allergy:${slug}`,
  label,
  kind: 'allergy',
});
const diet = (label: string, slug: string): RestrictionOption => ({
  code: `diet:${slug}`,
  label,
  kind: 'diet',
});
const religion = (label: string, slug: string): RestrictionOption => ({
  code: `religion:${slug}`,
  label,
  kind: 'religion',
});

/** Allergen / ingredient groups (reader-language labels). */
export const ALLERGEN_GROUPS: RestrictionGroup[] = [
  {
    label: 'Egg & dairy',
    kind: 'allergy',
    items: [allergy('Egg', 'egg'), allergy('Milk', 'milk'), allergy('Cheese', 'cheese'), allergy('Butter', 'butter'), allergy('Gelatin', 'gelatin'), allergy('Honey', 'honey')],
  },
  {
    label: 'Nuts & seeds',
    kind: 'allergy',
    items: [allergy('Peanut', 'peanut'), allergy('Walnut', 'walnut'), allergy('Almond', 'almond'), allergy('Cashew', 'cashew'), allergy('Pine nut', 'pinenut'), allergy('Sesame', 'sesame'), allergy('Mustard', 'mustard')],
  },
  {
    label: 'Grains & legumes',
    kind: 'allergy',
    items: [allergy('Wheat', 'wheat'), allergy('Buckwheat', 'buckwheat'), allergy('Barley', 'barley'), allergy('Soybean', 'soybean'), allergy('Corn', 'corn')],
  },
  {
    label: 'Shellfish & seafood',
    kind: 'allergy',
    items: [allergy('Shrimp', 'shrimp'), allergy('Crab', 'crab'), allergy('Squid', 'squid'), allergy('Octopus', 'octopus'), allergy('Oyster', 'oyster'), allergy('Clam', 'clam'), allergy('Shellfish', 'shellfish')],
  },
  {
    label: 'Fish & broth',
    kind: 'allergy',
    items: [allergy('Fish', 'fish'), allergy('Mackerel', 'mackerel'), allergy('Anchovy', 'anchovy'), allergy('Fish sauce', 'fishsauce')],
  },
  {
    label: 'Meat',
    kind: 'allergy',
    items: [allergy('Beef', 'beef'), allergy('Pork', 'pork'), allergy('Chicken', 'chicken')],
  },
  {
    label: 'Fruit & veg',
    kind: 'allergy',
    items: [allergy('Peach', 'peach'), allergy('Tomato', 'tomato'), allergy('Garlic', 'garlic'), allergy('Onion', 'onion'), allergy('Green onion', 'greenonion')],
  },
  {
    label: 'Other',
    kind: 'allergy',
    items: [allergy('Alcohol', 'alcohol'), allergy('Sulfites', 'sulfites')],
  },
];

/** Dietary + religion groups. */
export const LIFESTYLE_GROUPS: RestrictionGroup[] = [
  {
    label: 'Dietary',
    kind: 'diet',
    items: [diet('Vegetarian', 'vegetarian'), diet('Vegan', 'vegan'), diet('Pescatarian', 'pescatarian'), diet('Gluten-free', 'glutenfree'), diet('Low-spice', 'lowspice')],
  },
  {
    label: 'Religion',
    kind: 'religion',
    items: [religion('No pork', 'nopork'), religion('Halal', 'halal'), religion('No beef', 'nobeef'), religion('Kosher', 'kosher')],
  },
];

/** Spice 0–10 analogy labels (index = level). */
export const SPICE_SCALE = [
  'No heat — plain rice',
  'Very mild — soy egg',
  'Mild — gentle kimchi',
  "Warm — kids' tteokbokki",
  'Street tteokbokki',
  'Kimchi jjigae',
  'Jjamppong soup',
  'Buldak fire ramen',
  'Habanero',
  "Bird's-eye chili",
  'Cheongyang overload',
];

/** Nationality options (we have Flag glyphs for these codes). */
export const NATIONALITIES = [
  { code: 'US', label: 'United States' },
  { code: 'JP', label: 'Japan' },
  { code: 'TH', label: 'Thailand' },
  { code: 'VN', label: 'Vietnam' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
];

/** Reader-language options (display names; MVP ships English strings only). */
export const READER_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
];

/** code → reader label lookup (built from all groups). */
export const RESTRICTION_LABEL: Record<string, string> = Object.fromEntries(
  [...ALLERGEN_GROUPS, ...LIFESTYLE_GROUPS].flatMap((g) => g.items.map((it) => [it.code, it.label])),
);

/** Pretty label for a restriction code (falls back to the slug, title-cased). */
export function restrictionLabel(code: string): string {
  if (RESTRICTION_LABEL[code]) return RESTRICTION_LABEL[code];
  const slug = code.includes(':') ? code.split(':')[1] : code;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Popular dishes for the interests step (placeholder catalog). */
export const POPULAR_DISHES = [
  'Kimchi Stew',
  'Bibimbap',
  'Tteokbokki',
  'Korean BBQ',
  'Fried Chicken',
  'Bulgogi',
  'Japchae',
  'Gimbap',
  'Sundubu',
];
