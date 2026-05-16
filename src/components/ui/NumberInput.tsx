import { useEffect, useRef, useState } from "react";

interface NumberInputProps {
  /**
   * Current numeric value. Pass `undefined` for unset/blank state
   * (the input shows the placeholder).
   */
  value: number | undefined;
  /**
   * Called when the user types a valid finite number. Fires on every
   * keystroke (so live preview keeps working), but is NOT used to
   * back-propagate clamped values into the input's displayed text —
   * that would chop digits while the user is mid-type.
   */
  onChange: (next: number) => void;
  /**
   * Optional clear handler. If provided, the user can blank the input
   * and on blur the input commits `undefined` via this callback.
   * Without it, blanking the input restores the last known value.
   */
  onClear?: () => void;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Format the prop value when not focused (e.g. round to 2 dp for
   * display). Defaults to plain String(value). Stringifying a number
   * here is fine because typing replaces the displayed text — this
   * formatter only runs to render the prop value when the user is
   * NOT actively editing.
   */
  format?: (v: number) => string;
  title?: string;
  ariaLabel?: string;
  id?: string;
}

const defaultFormat = (v: number): string => (Number.isFinite(v) ? String(v) : "");

/**
 * A `<input type="number">` that keeps a stable internal string buffer
 * while the user is typing, so partial / clamped / scaled values don't
 * round-trip back into the displayed text mid-type.
 *
 * Previous (broken) pattern:
 *   <input value={someNumber} onChange={e => setN(parseFloat(e.target.value))} />
 *   Typing "100" into a max=1 field showed "1" because each keystroke
 *   clamped the stored value before React painted the next digit.
 *
 * This component:
 *   - Mirrors the prop into local text only when the input is NOT focused
 *     (so external updates — drag-resize overlays, resets — still propagate)
 *   - During focus, the displayed text is whatever the user has typed
 *   - onChange fires on every valid parse so live preview keeps working
 *   - On blur, the text is parsed once more and clamped against min/max,
 *     and the input shows the canonical formatted result
 *   - Enter blurs the field (commits) — convenient on mobile / keyboard
 */
export function NumberInput({
  value,
  onChange,
  onClear,
  min,
  max,
  step,
  className,
  placeholder,
  disabled,
  format,
  title,
  ariaLabel,
  id,
}: NumberInputProps) {
  const fmt = format ?? defaultFormat;
  const editingRef = useRef(false);
  const [text, setText] = useState<string>(() =>
    value === undefined ? "" : fmt(value),
  );

  // Re-sync displayed text from props when not actively typing. This
  // lets external updates (drag-overlays, Reset buttons, etc.) flow
  // through without clobbering live typing.
  useEffect(() => {
    if (editingRef.current) return;
    setText(value === undefined ? "" : fmt(value));
  }, [value, fmt]);

  return (
    <input
      type="number"
      id={id}
      aria-label={ariaLabel}
      title={title}
      step={step}
      min={min}
      max={max}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      onFocus={() => {
        editingRef.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        // Fire onChange so live preview updates as the user types, but
        // DON'T re-set the input's displayed text from props — that's
        // the bug we're fixing.
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) {
          // Do NOT clamp here. Clamping during typing would force the
          // value back down (e.g. typing "100" into max=1 collapses to 1)
          // and the next keystroke would see "1" + "0" = "10" and clamp
          // again. Clamp on blur only.
          onChange(parsed);
        }
      }}
      onBlur={(e) => {
        editingRef.current = false;
        const raw = e.target.value;
        const parsed = parseFloat(raw);
        if (!Number.isFinite(parsed)) {
          if (raw.trim() === "" && onClear) {
            onClear();
            setText("");
            return;
          }
          // Invalid input — restore the prop value.
          setText(value === undefined ? "" : fmt(value));
          return;
        }
        // Clamp against min / max only at commit time.
        let clamped = parsed;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        if (clamped !== parsed) onChange(clamped);
        setText(fmt(clamped));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
