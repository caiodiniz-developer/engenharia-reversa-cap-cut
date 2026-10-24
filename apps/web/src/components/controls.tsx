import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5">
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-2xs text-mute">{hint}</p>}
    </div>
  );
}

export function Section({ title, children, action, defaultOpen = true }: { title: string; children: ReactNode; action?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex items-center justify-between pr-2">
        <button type="button" className="flex flex-1 items-center gap-1 px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wider text-mute hover:text-ink" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

/** Campo numérico com controle deslizante opcional. Confirma ao soltar/Enter/blur para não gerar um passo de undo por tecla. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  slider = true,
  right,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  slider?: boolean;
  right?: ReactNode;
  onCommit?: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Number(value.toFixed(4)));
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    setDraft(null);
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
    onCommit?.();
  };
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="label !mb-0">
          {label}
        </label>
        {right}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {slider && min !== undefined && max !== undefined && (
          <input
            type="range"
            aria-label={`${label} (controle deslizante)`}
            min={min}
            max={max}
            step={step}
            value={Math.min(max, Math.max(min, value))}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
        )}
        <div className="relative w-20 shrink-0">
          <input
            id={id}
            className="field pr-6 text-right"
            inputMode="decimal"
            value={shown}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => draft !== null && commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setDraft(null);
            }}
          />
          {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-mute">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
}

export function TextInput({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const done = () => {
    if (draft !== null && draft !== value) onChange(draft);
    setDraft(null);
  };
  const common = { id, value: draft ?? value, placeholder, onChange: (e: { target: { value: string } }) => setDraft(e.target.value), onBlur: done };
  return (
    <div className="mb-2.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {multiline ? <textarea className="field h-20 resize-none py-1.5" {...common} /> : <input className="field" onKeyDown={(e) => e.key === 'Enter' && done()} {...common} />}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <label htmlFor={id} className="label !mb-0">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xs text-mute">{value}</span>
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent p-0.5" />
      </div>
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="mb-2.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-accent" />
      {label}
    </label>
  );
}

export function Modal({ open, onClose, title, children, width = 480 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[90vh] w-full overflow-auto rounded-xl border border-line bg-panel shadow-2xl outline-none"
            style={{ maxWidth: width }}
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">{title}</h2>
              <button type="button" className="btn-icon" aria-label="Fechar" onClick={onClose}>
                <Icon name="x" />
              </button>
            </header>
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon: Parameters<typeof Icon>[0]['name']; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-mute">
      <Icon name={icon} size={28} />
      <p className="text-xs font-medium text-ink">{title}</p>
      {hint && <p className="max-w-[220px] text-2xs">{hint}</p>}
    </div>
  );
}
