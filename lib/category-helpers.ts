// Helpers para categorías: slugify y resolución de slugs únicos.

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ensureUniqueSlug(
  base: string,
  existingSlugs: string[],
  ignoreId?: string,
): string {
  const taken = new Set(existingSlugs.filter((s) => s !== ignoreId));
  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}
