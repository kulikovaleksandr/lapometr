import {
  ButtonHTMLAttributes, CSSProperties, ReactNode, useEffect, useMemo, useRef, useState,
} from "react";
import { Icon } from "./icons";
import type { IconName, User } from "../lib/types";

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

/* ---------- Кнопка ---------- */
const V: Record<string, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-105 shadow-[0_6px_18px_color-mix(in_oklab,var(--accent)_35%,transparent)]",
  soft: "bg-raise text-ink hover:bg-line/70",
  ghost: "text-mute hover:text-ink hover:bg-raise",
  outline: "border border-line bg-transparent text-ink hover:border-accent hover:text-accent",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};
const S: Record<string, string> = {
  sm: "px-3 py-1.5 text-[12.5px] rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-5 py-3 text-[15px] rounded-xl gap-2",
};
export function Btn({
  variant = "primary", size = "md", className = "", children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof V; size?: keyof typeof S }) {
  return (
    <button
      className={cx(
        "inline-flex select-none items-center justify-center font-semibold transition-all duration-200",
        "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        V[variant], S[size], className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Модалка ---------- */
export function Modal({ open, onClose, title, children, w = "max-w-md" }:
  { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; w?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true">
      <div className="anim-fade fixed inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx("card anim-pop relative w-full p-6", w)}>
        {title !== undefined && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <h3 className="font-display text-[17px] leading-snug">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-mute transition hover:bg-raise hover:text-ink"
              aria-label="Закрыть"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------- Поля ---------- */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-mute/80">{hint}</span>}
    </label>
  );
}
export const inputCls =
  "w-full rounded-xl border border-line bg-bg2 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-mute/60 focus:border-accent focus:bg-surface";

/* ---------- Чип / сегменты ---------- */
export function Chip({ active, onClick, children, color }:
  { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all",
        active
          ? "border-transparent text-accent-ink shadow-sm"
          : "border-line text-mute hover:border-mute hover:text-ink",
      )}
      style={active ? { background: color ?? "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}

export function Seg<T extends string>({ options, value, onChange, className }:
  { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx("inline-flex flex-wrap gap-1 rounded-xl border border-line bg-bg2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all",
            value === o.id ? "bg-surface text-ink shadow-sm" : "text-mute hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Прогресс ---------- */
export function Bar({ value, color = "var(--accent)", h = 8, className = "" }:
  { value: number; color?: string; h?: number; className?: string }) {
  return (
    <div className={cx("w-full overflow-hidden rounded-full bg-raise", className)} style={{ height: h }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, transition: "width .7s cubic-bezier(.2,.7,.3,1)" }}
      />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, color = "var(--accent)", children }:
  { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ---------- Счётчик с анимацией ---------- */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) { setDisp(value); return; }
    const t0 = performance.now();
    const dur = 650;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(Math.round(from + (value - from) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{disp.toLocaleString("ru-RU")}</span>;
}

/* ---------- Аватары ---------- */
export function UserAvatar({ user, size = 36, ring }: { user: User; size?: number; ring?: boolean }) {
  if (user.img) {
    return (
      <img
        src={user.img} alt={user.name} width={size} height={size}
        className="shrink-0 rounded-full object-cover"
        style={ring ? { boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${user.color}` } : undefined}
      />
    );
  }
  const initials = user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold"
      style={{
        width: size, height: size, background: user.color, color: "rgba(32,20,6,0.75)",
        fontSize: Math.max(10, size * 0.36),
        boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 4px ${user.color}` : undefined,
      }}
    >
      {initials}
    </span>
  );
}

/* ---------- Взрыв лапок ---------- */
export function Burst({ seed }: { seed: number }) {
  const parts = useMemo(
    () => Array.from({ length: 9 }, () => ({
      dx: (Math.random() * 2 - 1) * 85,
      dy: -25 - Math.random() * 85,
      r: (Math.random() * 2 - 1) * 95,
      s: 0.6 + Math.random() * 0.9,
      d: Math.random() * 0.12,
    })),
    [seed],
  );
  return (
    <span className="pointer-events-none absolute inset-0 z-10">
      {parts.map((p, i) => (
        <span
          key={`${seed}-${i}`}
          className="paw-fly"
          style={{
            "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--r": `${p.r}deg`, "--s": p.s,
            animationDelay: `${p.d}s`,
          } as CSSProperties}
        >
          <Icon name="paw" size={16} />
        </span>
      ))}
    </span>
  );
}

/* ---------- Пустое состояние ---------- */
export function EmptyState({ icon = "paw", title, text, action }:
  { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-raise text-mute">
        <Icon name={icon} size={26} />
      </span>
      <p className="font-display text-[15px]">{title}</p>
      {text && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-mute">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Появление при скролле ---------- */
export function Reveal({ children, delay = 0, className = "" }:
  { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("on"); io.disconnect(); } },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
