// Hook genérico para debounce de un valor reactivo.
//
// Devuelve `[value, setter]` donde `value` se actualiza con un retraso
// de `delayMs` desde el último cambio. Útil para inputs de búsqueda que
// disparan server actions en cada pulsación.

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
