const ARCHETYPE_IMAGES: Record<string, string> = {
  // Put image files in public/archetypes and map canonical deck names here.
  // Examples:
  // "mono red": "/archetypes/mono-red.webp",
  // "dimir faeries": "/archetypes/dimir-faeries.webp",
  // "jund gardens": "/archetypes/jund-gardens.webp",
};

export function getArchetypeImage(deck: string): string | null {
  return ARCHETYPE_IMAGES[deck.trim().toLowerCase()] ?? null;
}
