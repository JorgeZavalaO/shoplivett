import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CancelLink({
  href,
  children = "Cancelar",
}: {
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Button variant="ghost" render={<Link href={href}>{children}</Link>} />
  );
}
