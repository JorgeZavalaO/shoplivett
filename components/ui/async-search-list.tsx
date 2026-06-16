"use client"

import * as React from "react"
import { Loader2, Search, SearchX } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type AsyncSearchListProps<T> = {
  value: string
  onValueChange: (next: string) => void
  onSearch: (query: string) => void | Promise<void>
  isLoading: boolean
  results: T[]
  isQueryTooShort?: boolean
  placeholder?: string
  emptyMessage?: string
  noResultsMessage?: string
  errorMessage?: string | null
  className?: string
  renderItem: (
    item: T,
    helpers: { selected: boolean; onSelect: () => void },
  ) => React.ReactNode
  isItemSelected?: (item: T) => boolean
  onSelectItem: (item: T) => void
  getKey: (item: T) => string
  autoFocus?: boolean
  disabled?: boolean
}

export function AsyncSearchList<T>({
  value,
  onValueChange,
  onSearch,
  isLoading,
  results,
  isQueryTooShort = false,
  placeholder = "Buscar…",
  emptyMessage = "Empieza a escribir para buscar.",
  noResultsMessage = "Sin resultados para tu búsqueda.",
  errorMessage,
  className,
  renderItem,
  isItemSelected,
  onSelectItem,
  getKey,
  autoFocus = false,
  disabled = false,
}: AsyncSearchListProps<T>) {
  const hasResults = results.length > 0
  const showEmpty = !isLoading && !isQueryTooShort && !hasResults

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9"
          value={value}
          onChange={(e) => {
            const next = e.target.value
            onValueChange(next)
            void onSearch(next)
          }}
          aria-label={placeholder}
        />
        {isLoading ? (
          <Loader2
            aria-label="Buscando"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      {isQueryTooShort ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : null}

      {showEmpty && !isQueryTooShort ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <SearchX className="size-3.5" />
          {value.trim().length === 0 ? emptyMessage : noResultsMessage}
        </div>
      ) : null}

      {hasResults ? (
        <ul
          role="listbox"
          className="max-h-60 overflow-y-auto rounded-lg border border-border bg-card"
        >
          {results.map((item) => (
            <li key={getKey(item)}>
              <button
                type="button"
                role="option"
                aria-selected={isItemSelected ? isItemSelected(item) : false}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  isItemSelected?.(item) && "bg-muted/50",
                )}
                onClick={() => onSelectItem(item)}
              >
                {renderItem(item, {
                  selected: isItemSelected ? !!isItemSelected(item) : false,
                  onSelect: () => onSelectItem(item),
                })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
