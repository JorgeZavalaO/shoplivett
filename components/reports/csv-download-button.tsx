import type { Route } from "next";

import { Button } from "@/components/ui/button";

type Props = {
  href: string;
  filename?: string;
  label?: string;
};

export function CsvDownloadButton({ href, label = "Descargar CSV" }: Props) {
  return (
    <Button
      size="sm"
      variant="outline"
      render={<a href={href as Route} download>📄 {label}</a>}
    />
  );
}
