import { PAIRS, pairById } from "@/lib/market/pairs";
import { shareImage } from "@/lib/site/share-image";

// One card per pair we chart, drawn at build time; any other pair is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PAIRS.map((pair) => ({ pair: pair.id }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pair: string }> },
) {
  const pair = pairById((await params).pair);
  if (!pair) return new Response("Not found", { status: 404 });
  return shareImage(pair);
}
