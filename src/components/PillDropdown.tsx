import { useEffect, useRef, useState } from "preact/hooks";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  count?: number;
  isActive?: boolean;
  disabled?: boolean;
  children: preact.ComponentChildren;
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * A pill-shaped button that opens a dropdown panel on click.
 *
 * Inspired by Framer's Pill Dropdown Nav pattern: a compact trigger that
 * expands to reveal a panel of options. Closes on outside click or Escape.
 */
export default function PillDropdown({
  label,
  count,
  isActive = false,
  disabled = false,
  children,
  onOpenChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setIsOpen(false);
    onOpenChange?.(false);
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onOpenChange?.(next);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
          "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          isOpen && "bg-muted text-foreground",
          disabled && "cursor-wait opacity-60",
        )}
      >
        {label}
        {count !== undefined && count > 0 && (
          <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-xs font-semibold tabular-nums text-primary">
            {count}
          </span>
        )}
        <svg
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 4 4 4-4"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
