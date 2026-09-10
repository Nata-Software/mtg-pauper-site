import { redirect } from "next/navigation";

/**
 * The deck grid was at /decks while it was being evaluated; it is now the
 * landing page. Individual decks stay at /decks/<name>, so this only forwards
 * the index for anyone holding the old link.
 */
export default async function DecksIndexRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range = Array.isArray(sp.range) ? sp.range[0] : sp.range;

  redirect(range ? `/?range=${encodeURIComponent(range)}` : "/");
}
