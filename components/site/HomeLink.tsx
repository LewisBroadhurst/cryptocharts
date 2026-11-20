import Link from "next/link";

import StratDeckMark from "@/components/site/StratDeckMark";

/** The site's name, with StratDeck's mark, linking home. */
export default function HomeLink() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-1.5 text-base font-semibold text-foreground"
    >
      <StratDeckMark size={20} />
      Crypto Charts
    </Link>
  );
}
