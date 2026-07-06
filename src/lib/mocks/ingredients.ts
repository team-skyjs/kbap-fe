/**
 * mocks/ingredients.ts — flat ingredient catalog (KB-6 override). Replaces the
 * category-grouped restriction taxonomy: a user's restrictions are a FLAT list
 * of ingredient codes (no Allergy/Dietary/Religion grouping, no per-ingredient
 * pre-assigned risk color — risk is contextual per dish, decided by the BE).
 *
 * This is BE catalog DATA (stub for MOCK_MODE): each entry is { code, name }.
 * Diet/religion intents are expressed as concrete ingredients to avoid
 * (e.g. "no pork" → avoid `ing:pork`; "halal" → avoid pork + alcohol).
 * Shared by the profile restrictions editor (I6) and onboarding (KB-8).
 */

import i18n from '@/lib/i18n';

export interface Ingredient {
  code: string; // stable catalog code, e.g. "ing:shrimp"
  name: string; // English fallback name (display goes through ingredientLabel → i18n)
}

const ing = (slug: string, name: string): Ingredient => ({ code: `ing:${slug}`, name });

/** 81-ingredient stub catalog (flat, unordered by design — searchable in UI). */
export const INGREDIENTS: Ingredient[] = [
  ing('egg', 'Egg'), ing('milk', 'Milk'), ing('cheese', 'Cheese'), ing('butter', 'Butter'),
  ing('yogurt', 'Yogurt'), ing('gelatin', 'Gelatin'), ing('honey', 'Honey'),
  ing('peanut', 'Peanut'), ing('walnut', 'Walnut'), ing('almond', 'Almond'), ing('cashew', 'Cashew'),
  ing('pistachio', 'Pistachio'), ing('pinenut', 'Pine nut'), ing('sesame', 'Sesame'), ing('mustard', 'Mustard'),
  ing('sunflowerseed', 'Sunflower seed'),
  ing('wheat', 'Wheat'), ing('buckwheat', 'Buckwheat'), ing('barley', 'Barley'), ing('rye', 'Rye'),
  ing('oat', 'Oat'), ing('corn', 'Corn'), ing('rice', 'Rice'),
  ing('soybean', 'Soybean'), ing('tofu', 'Tofu'), ing('soysauce', 'Soy sauce'), ing('doenjang', 'Soybean paste'),
  ing('gochujang', 'Chili paste'), ing('redbean', 'Red bean'),
  ing('shrimp', 'Shrimp'), ing('crab', 'Crab'), ing('lobster', 'Lobster'), ing('squid', 'Squid'),
  ing('octopus', 'Octopus'), ing('cuttlefish', 'Cuttlefish'), ing('clam', 'Clam'), ing('oyster', 'Oyster'),
  ing('mussel', 'Mussel'), ing('abalone', 'Abalone'), ing('seasnail', 'Sea snail'), ing('scallop', 'Scallop'),
  ing('shellfish', 'Shellfish'),
  ing('fish', 'Fish'), ing('mackerel', 'Mackerel'), ing('anchovy', 'Anchovy'), ing('tuna', 'Tuna'),
  ing('pollock', 'Pollock'), ing('cod', 'Cod'), ing('salmon', 'Salmon'), ing('eel', 'Eel'),
  ing('fishsauce', 'Fish sauce'), ing('fishcake', 'Fish cake'), ing('shrimppaste', 'Shrimp paste'),
  ing('beef', 'Beef'), ing('pork', 'Pork'), ing('chicken', 'Chicken'), ing('duck', 'Duck'),
  ing('lamb', 'Lamb'), ing('ham', 'Ham'), ing('sausage', 'Sausage'), ing('bloodsausage', 'Blood sausage'),
  ing('garlic', 'Garlic'), ing('onion', 'Onion'), ing('greenonion', 'Green onion'), ing('ginger', 'Ginger'),
  ing('chili', 'Chili pepper'), ing('perilla', 'Perilla'), ing('cilantro', 'Cilantro'),
  ing('tomato', 'Tomato'), ing('peach', 'Peach'), ing('kiwi', 'Kiwi'), ing('apple', 'Apple'),
  ing('mango', 'Mango'), ing('mushroom', 'Mushroom'), ing('eggplant', 'Eggplant'), ing('spinach', 'Spinach'),
  ing('alcohol', 'Alcohol'), ing('ricewine', 'Rice wine'), ing('vinegar', 'Vinegar'), ing('msg', 'MSG'),
  ing('sulfites', 'Sulfites'),
];

const BY_CODE: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.code, i]));

/**
 * Reader-language display name for an ingredient code. Resolved from i18n
 * (`ingredients.<slug>`) so it follows the active language; the catalog English
 * name is the fallback. Uses the global i18n instance so it works outside React
 * components too (callers re-render on languageChanged via useTranslation).
 */
export function ingredientLabel(code: string): string {
  const slug = code.startsWith('ing:') ? code.slice(4) : code.includes(':') ? code.split(':')[1] : code;
  const fallback = BY_CODE[code]?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  return i18n.t(`ingredients.${slug}`, { defaultValue: fallback });
}
