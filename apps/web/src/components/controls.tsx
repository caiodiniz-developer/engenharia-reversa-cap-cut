import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5">
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-2xs text-mute">{hint}</p>}
    </div>
  );
}

export function Section({
  title,
  children,
  action,
  defaultOpen = true,
  forceOpen = false,
  icon,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  // Abre quando o conteúdo passa a existir (ex.: uma transição acabou de ser aplicada).
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  return (
    <section className="border-b border-line/70">
      <div className="flex items-center justify-between pr-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 px-3 py-2.5 text-left text-xs font-semibold text-ink/90 hover:text-ink"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} className="text-mute" />
          {icon && <Icon name={icon} size={13} className="text-mute" />}
          {title}
        </button>
        {action}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

/** Abas horizontais (role=tablist). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className = '',
}: {
  tabs: Array<{ id: T; label: string; badge?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-0.5 border-b border-line px-2 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`relative flex-1 whitespace-nowrap px-1.5 py-2.5 text-xs font-medium transition-colors ${value === t.id ? 'text-ink' : 'text-mute hover:text-ink'}`}
        >
          {t.label}
          {!!t.badge && <span className="ml-1 rounded-full bg-accent/20 px-1.5 text-2xs text-accent">{t.badge}</span>}
          {value === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

/** Controle segmentado (opções mutuamente exclusivas, poucas e curtas). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; icon?: IconName }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-2xs font-medium transition-colors ${value === o.value ? 'bg-panel-3 text-ink shadow-sm' : 'text-mute hover:text-ink'}`}
        >
          {o.icon && <Icon name={o.icon} size={12} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Campo numérico em uma linha: rótulo · controle deslizante · valor. Confirma ao soltar/Enter/blur para
 * não gerar um passo de undo por tecla.
 */
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
  const hasSlider = slider && min !== undefined && max !== undefined;
  const pct = hasSlider ? ((Math.min(max!, Math.max(min!, value)) - min!) / (max! - min! || 1)) * 100 : 0;
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    setDraft(null);
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
    onCommit?.();
  };
  return (
    <div className="mb-1.5 grid items-center gap-x-2" style={{ gridTemplateColumns: hasSlider ? '88px minmax(0,1fr) 62px' : '88px minmax(0,1fr)' }}>
      <div className="flex min-w-0 items-center justify-between gap-1">
        <label htmlFor={id} className="truncate text-xs text-mute" title={label}>
          {label}
        </label>
        {right}
      </div>
      {hasSlider && (
        <input
          type="range"
          aria-label={`${label} (controle deslizante)`}
          min={min}
          max={max}
          step={step}
          value={Math.min(max!, Math.max(min!, value))}
          style={{ '--p': `${pct}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
      )}
      <div className={`relative ${hasSlider ? '' : 'w-[62px] justify-self-end'}`}>
        <input
          id={id}
          className="field tnum h-7 pr-5 text-right"
          inputMode="decimal"
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => draft !== null && commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setDraft(null);
          }}
        />
        {unit && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-2xs text-mute">{unit}</span>}
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
    <div className="mb-1.5 grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-2">
      <label htmlFor={id} className="truncate text-xs text-mute">
        {label}
      </label>
      <div className="flex items-center justify-end gap-2">
        <span className="tnum font-mono text-2xs uppercase text-mute">{value}</span>
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded-md border border-line bg-transparent p-0.5" />
      </div>
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="mb-2 grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-2">
      <label htmlFor={id} className="truncate text-xs text-mute" title={label}>
        {label}
      </label>
      <select id={id} className="field h-7" value={value} onChange={(e) => onChange(e.target.value as T)}>
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
    <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs text-ink">
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
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[90vh] w-full overflow-auto rounded-2xl border border-line bg-panel shadow-pop outline-none"
            style={{ maxWidth: width }}
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold">{title}</h2>
              <button type="button" className="btn-icon" aria-label="Fechar" onClick={onClose}>
                <Icon name="x" />
              </button>
            </header>
            <div className="p-5">{children}</div>
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

export function Empty({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-mute">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-panel-3">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-xs font-medium text-ink">{title}</p>
      {hint && <p className="max-w-[240px] text-2xs leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

/** Cartão clicável de painel (efeito, transição, modelo...). */
export function TileButton({ title, subtitle, icon, onClick, disabled, active }: { title: string; subtitle?: string; icon?: IconName; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`card card-hover flex h-full w-full flex-col items-start gap-1 p-2.5 text-left disabled:opacity-40 ${active ? 'border-accent/60' : ''}`} title={subtitle}>
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {icon && <Icon name={icon} size={13} className="text-accent" />}
        {title}
      </span>
      {subtitle && <span className="text-2xs leading-tight text-mute">{subtitle}</span>}
    </button>
  );
}
