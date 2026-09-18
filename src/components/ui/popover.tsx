import type { ComponentChild } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui-style popover primitive, without upstream's context and `cloneElement`
 * wiring: the trigger is a render prop, so the consumer keeps full control of its
 * markup and the panel is anchored to the trigger by CSS alone.
 *
 * Why it exists: the dropdown this replaces rendered a translucent, page-sized fixed
 * overlay as its outside-click catcher, which made every control on the page unclickable
 * while a panel was open, and its panel was pushed down by a fixed margin from a wrapper
 * that was not positioned, so it landed on top of the trigger that had opened it. Here the
 * wrapper is `relative`, the panel drops from `top-full`, and outside-click is a document
 * listener instead of a page-sized element.
 *
 * Composition:
 *
 *   Popover            (relative anchor)
 *   ├── trigger(props) (render prop: owns the markup, spreads the aria wiring)
 *   └── panel          (absolute, always mounted, toggled with `hidden`)
 *
 * Tailwind 3 adaptation of the upstream (Tailwind 4) classes: Tailwind 3 has no
 * `anchor()`/position-area support, so the panel is positioned against the `relative`
 * wrapper with `absolute top-full mt-2` instead of relying on CSS anchor positioning.
 */

/**
 * What counts as a panel's first focusable control. Used to place focus when a panel
 * opens, and for nothing else: Tab is deliberately not trapped (see the focus effect).
 */
const FIRST_FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export interface TriggerProps {
  id: string;
  ref: any;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "true";
  onClick: () => void;
}

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: (props: TriggerProps) => ComponentChild;
  /**
   * Id to give the trigger. It is also what names the panel, so the accessible name of
   * the panel and the id `aria-controls` resolves from stay tied to one string.
   */
  labelledBy: string;
  panelClassName?: string;
  children: ComponentChild;
}

export default function Popover({
  isOpen,
  onClose,
  trigger,
  labelledBy,
  panelClassName,
  children,
}: PopoverProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<any>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // The latest close handler, in a ref rather than in the dependency array: callers pass
  // it as an inline closure, so its identity changes on every render and the effect below
  // would tear down and re-add both document listeners each time anything re-rendered
  // while a panel was open. `isOpen` is the only input that changes what they do.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Derived, and deliberately different from the id the consumer puts on its own
  // content element: `aria-controls` has to resolve to the wrapper this primitive
  // hides, and it stays in the DOM at all times for that reason.
  const panelId = `${labelledBy}-panel`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current;
      if (wrapper && event.target instanceof Node && wrapper.contains(event.target)) {
        return;
      }
      // Close on the way down, so the panel is gone before the click lands, and never
      // move focus: the pointer already aimed at whatever is underneath.
      onCloseRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onCloseRef.current();
      // Escape must not strand focus inside a panel that is no longer visible.
      triggerRef.current?.focus?.();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // Only `isOpen`: `onClose` is read through the ref above.
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Focus moves to the panel's first focusable control so a keyboard user lands inside
    // the panel instead of having to tab in from the trigger. Tab is deliberately NOT
    // trapped: these popovers are non-modal, and the checkbox list has no chrome of its
    // own to cycle within, so a trap would fight the browser for no benefit. An empty
    // panel is left alone rather than focused.
    panelRef.current?.querySelector<HTMLElement>(FIRST_FOCUSABLE)?.focus();
  }, [isOpen]);

  const triggerProps: TriggerProps = {
    id: labelledBy,
    ref: triggerRef,
    "aria-expanded": isOpen,
    "aria-controls": panelId,
    "aria-haspopup": "true",
    // The primitive does not own `isOpen`, so it cannot open the panel by itself: this
    // is the close half of the toggle, which the consumer composes with its own open
    // action. Outside-click and Escape call `onClose` directly.
    onClick: () => {
      if (isOpen) onClose();
    },
  };

  return (
    <div
      ref={wrapperRef}
      data-slot="popover"
      data-state={isOpen ? "open" : "closed"}
      className="relative"
    >
      {trigger(triggerProps)}
      <div
        id={panelId}
        ref={panelRef}
        data-slot="popover-panel"
        // The HTML `hidden` attribute, not a `hidden` utility: hiding the panel this
        // way takes its checkboxes out of the tab order while it is closed, and the
        // element stays mounted so `aria-controls` always resolves to something.
        hidden={!isOpen}
        aria-labelledby={labelledBy}
        className={cn(
          // `z-30` clears the page's own `z-20` heading and logo layers; the panel is
          // the topmost interactive surface while it is open.
          "absolute top-full z-30 mt-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
