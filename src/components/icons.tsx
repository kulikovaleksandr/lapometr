import type { ReactNode } from "react";
import type { IconName, Species } from "../lib/types";

const P: Record<IconName, ReactNode> = {
  paw: (
    <g fill="currentColor" stroke="none">
      <circle cx="5.2" cy="9.7" r="1.9" />
      <circle cx="9.6" cy="5.9" r="2" />
      <circle cx="14.4" cy="5.9" r="2" />
      <circle cx="18.8" cy="9.7" r="1.9" />
      <path d="M12 10.3c-2.9 0-5.7 2.5-5.7 5.2 0 2 1.5 3.4 3.3 3.4.9 0 1.6-.4 2.4-.4s1.5.4 2.4.4c1.8 0 3.3-1.4 3.3-3.4 0-2.7-2.8-5.2-5.7-5.2z" />
    </g>
  ),
  heart: <path d="M12 20s-7.5-4.8-9.3-9.2C1.5 7.9 3.4 5 6.3 5 8.6 5 10.6 6.6 12 8.7 13.4 6.6 15.4 5 17.7 5c2.9 0 4.8 2.9 3.6 5.8C19.5 15.2 12 20 12 20z" />,
  feed: (
    <>
      <path d="M4.5 13h15l-1.6 5.3a2 2 0 0 1-1.9 1.5H8a2 2 0 0 1-1.9-1.5L4.5 13z" />
      <path d="M7.2 13a4.8 4.8 0 0 1 9.6 0" />
      <path d="M9.4 7h.01M12 5.4h.01M14.6 7h.01" />
    </>
  ),
  water: (
    <>
      <path d="M12 3.5s5.5 6.2 5.5 10a5.5 5.5 0 0 1-11 0c0-3.8 5.5-10 5.5-10z" />
      <path d="M9.4 14a2.6 2.6 0 0 0 2.6 2.6" />
    </>
  ),
  pet: (
    <>
      <path d="M12 20s-7.5-4.8-9.3-9.2C1.5 7.9 3.4 5 6.3 5 8.6 5 10.6 6.6 12 8.7 13.4 6.6 15.4 5 17.7 5c2.9 0 4.8 2.9 3.6 5.8C19.5 15.2 12 20 12 20z" />
      <path d="M8.5 3.2 8 1.8M15.5 3.2l.5-1.4" />
    </>
  ),
  syringe: (
    <>
      <path d="m18 2 4 4" /><path d="m17 7 3-3" />
      <path d="M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5" />
      <path d="m9 11 4 4" /><path d="m5 19-3 3" /><path d="m14 4 6 6" />
    </>
  ),
  pill: (
    <>
      <rect x="9.2" y="2.5" width="5.6" height="19" rx="2.8" transform="rotate(45 12 12)" />
      <path d="M10 14 14 10" />
    </>
  ),
  litter: (
    <>
      <path d="M3.5 8.5h17l-1.9 10a2.2 2.2 0 0 1-2.2 1.8H7.6a2.2 2.2 0 0 1-2.2-1.8l-1.9-10z" />
      <path d="M8 8.5V7a4 4 0 0 1 8 0v1.5" />
      <path d="M9.5 13h.01M12 16h.01M14.5 13h.01" />
    </>
  ),
  brush: (
    <>
      <path d="M7 3.5h10v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6z" />
      <path d="M9.3 11.5v9M12 11.5v9M14.7 11.5v9" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M5.2 6.8c3.6 3.3 3.6 7.1 0 10.4M18.8 6.8c-3.6 3.3-3.6 7.1 0 10.4" />
    </>
  ),
  eyes: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  ears: (
    <>
      <path d="M7 9a5 5 0 0 1 10 0c0 2.6-1.6 3.6-2.5 5.2-.7 1.3-.6 3.3-2.5 3.3a2.7 2.7 0 0 1-2.7-2.7" />
      <path d="M10 9a2 2 0 0 1 4 0c0 1.5-.9 2-1.4 3" />
    </>
  ),
  walk: (
    <g fill="currentColor" stroke="none">
      <circle cx="5.5" cy="5.5" r="1.3" /><circle cx="9" cy="4.2" r="1.3" />
      <path d="M7.4 7.2c-1.7 0-3.2 1.4-3.2 3 0 1.2.9 2 2 2 .5 0 .9-.2 1.3-.2s.8.2 1.3.2c1.1 0 2-.8 2-2 0-1.6-1.6-3-3.4-3z" />
      <circle cx="15" cy="14.5" r="1.3" /><circle cx="18.5" cy="13.2" r="1.3" />
      <path d="M16.9 16.2c-1.7 0-3.2 1.4-3.2 3 0 1.2.9 2 2 2 .5 0 .9-.2 1.3-.2s.8.2 1.3.2c1.1 0 2-.8 2-2 0-1.6-1.6-3-3.4-3z" />
    </g>
  ),
  nails: (
    <>
      <circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" />
      <path d="M8.2 7.6 20 19M8.2 16.4 20 5" />
    </>
  ),
  bath: (
    <>
      <path d="M5 12.5h14v1a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-1z" />
      <path d="M7 12.5V6.5a2.5 2.5 0 0 1 5 0" />
      <path d="M15.5 6h.01M18 8h.01M16.5 10.5h.01" />
    </>
  ),
  tooth: <path d="M12 4.6C10.8 3.7 9.5 3.2 8 3.2 5.3 3.2 3.6 5.2 3.6 7.8c0 3.8 1.9 6 2.5 8.9.3 1.4.9 3.6 2.3 3.6 1.7 0 1.2-3 1.7-4.9.3-1 .9-1.8 1.9-1.8s1.6.8 1.9 1.8c.5 1.9 0 4.9 1.7 4.9 1.4 0 2-2.2 2.3-3.6.6-2.9 2.5-5.1 2.5-8.9 0-2.6-1.7-4.6-4.4-4.6-1.5 0-2.8.5-4 1.4z" />,
  bell: (
    <>
      <path d="M18 10a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.5 19.5a1.8 1.8 0 0 0 3 0" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  flame: <path d="M12 3c.4 2.6 2 4.2 3.5 6A6.7 6.7 0 0 1 17.4 13a5.4 5.4 0 0 1-10.8 0c0-1.5.5-2.9 1.4-4.2.6-.9 1.5-1.9 2-3.3.4-1 1-1.9 2-2.5z M12 21a3.5 3.5 0 0 1-3.5-3.5c0-1.5 1.2-2.6 2-3.7.6.9 5 2.2 5 3.7A3.5 3.5 0 0 1 12 21z" />,
  chart: <path d="M5 20v-7M10 20V6M15 20v-9M20 20v-4M3 20h18" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3.5 20c.5-3.5 2.7-5.5 5.5-5.5s5 2 5.5 5.5" />
      <path d="M16 5.6a3 3 0 0 1 0 5.8M17.8 14.6c1.6.8 2.5 2.4 2.8 4.4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2" />
    </>
  ),
  out: <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12h-9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m4.5 12.5 5.5 5.5L19.5 6.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  crown: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-1.6 10.2H4.6L3 8z" />,
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  home: <path d="m4 11.5 8-7.5 8 7.5M6.5 10v10h11V10M10 20v-5.5h4V20" />,
  camera: (
    <>
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" />
      <circle cx="12" cy="13.5" r="3.5" />
      <path d="M8.5 7.5 10 5h4l1.5 2.5" />
    </>
  ),
  edit: <path d="m4 20 1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1zM14.5 6.5l3 3" />,
  trash: (
    <>
      <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="m6.5 7 1 12.2A2 2 0 0 0 9.5 21h5a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  spark: <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
  chev: <path d="m9 6 6 6-6 6" />,
  download: <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4.5 20h15" />,
  upload: <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4.5 20h15" />,
  cloud: <path d="M7 18.5h10a4 4 0 0 0 .8-7.92 5.5 5.5 0 0 0-10.7-1.16A4.6 4.6 0 0 0 7 18.5z" />,
  alert: <path d="M12 4 2.8 19.5h18.4L12 4zM12 10v4M12 17h.01" />,
  dot: <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />,
};

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[28%] bg-accent text-accent-ink"
      style={{ width: size, height: size, boxShadow: "0 4px 14px color-mix(in oklab, var(--accent) 45%, transparent)" }}
    >
      <Icon name="paw" size={Math.round(size * 0.62)} />
    </span>
  );
}

/* ============ Морды питомцев ============ */
const INK = "rgba(40,28,14,0.4)";
const LIGHT = "rgba(255,255,255,0.55)";

export function PetFace({ species, color, size = 96, className = "" }:
  { species: Species; color: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      {species === "cat" && (
        <g>
          <path d="M15 27 10 7l16 10z" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M49 27 54 7 38 17z" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M15.5 22 13 12l8 5z" fill={LIGHT} />
          <path d="M48.5 22 51 12l-8 5z" fill={LIGHT} />
          <ellipse cx="32" cy="37" rx="21" ry="19" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="24" cy="34" r="2.8" fill="#2b2118" />
          <circle cx="40" cy="34" r="2.8" fill="#2b2118" />
          <circle cx="25" cy="33" r="0.9" fill="#fff" />
          <circle cx="41" cy="33" r="0.9" fill="#fff" />
          <path d="M29.5 41h5L32 44.5z" fill="#2b2118" opacity="0.75" />
          <path d="M32 44.5c0 2.4-1.8 3.4-3.8 3.4M32 44.5c0 2.4 1.8 3.4 3.8 3.4" stroke="#2b2118" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M6 37h11M6 43l11-1.6M58 37H47M58 43l-11-1.6" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}
      {species === "dog" && (
        <g>
          <path d="M14 20c-5 7-5 20 1 24 3.4 2.3 6.5 0 6.5-3.6V22z" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M50 20c5 7 5 20-1 24-3.4 2.3-6.5 0-6.5-3.6V22z" fill={color} stroke={INK} strokeWidth="1.5" />
          <ellipse cx="32" cy="36" rx="19" ry="20" fill={color} stroke={INK} strokeWidth="1.5" />
          <ellipse cx="32" cy="43" rx="10" ry="8.5" fill={LIGHT} />
          <circle cx="24.5" cy="31" r="2.6" fill="#2b2118" />
          <circle cx="39.5" cy="31" r="2.6" fill="#2b2118" />
          <circle cx="25.4" cy="30.2" r="0.8" fill="#fff" />
          <circle cx="40.4" cy="30.2" r="0.8" fill="#fff" />
          <ellipse cx="32" cy="41" rx="3.6" ry="2.8" fill="#2b2118" opacity="0.8" />
          <path d="M29 47.5c0 4 1.3 6 3 6s3-2 3-6" fill="#e59a9a" stroke={INK} strokeWidth="1.2" />
        </g>
      )}
      {species === "rabbit" && (
        <g>
          <path d="M23 5c-4.4 0-6.5 3.4-6.5 8.5S19 26 23 26s6.5-7.4 6.5-12.5S27.4 5 23 5z" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M41 5c4.4 0 6.5 3.4 6.5 8.5S45 26 41 26s-6.5-7.4-6.5-12.5S36.6 5 41 5z" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M22.5 9c-2 0-3 1.8-3 4.5S21 19 22.8 19s3.2-3.7 3.2-6.5S24.5 9 22.5 9z" fill={LIGHT} />
          <path d="M41.5 9c2 0 3 1.8 3 4.5S43 19 41.2 19 38 15.3 38 12.5 39.5 9 41.5 9z" fill={LIGHT} />
          <circle cx="32" cy="40" r="18" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="25" cy="37" r="2.6" fill="#2b2118" />
          <circle cx="39" cy="37" r="2.6" fill="#2b2118" />
          <path d="M30 43h4l-2 2.6z" fill="#2b2118" opacity="0.75" />
          <rect x="29.4" y="46" width="5.2" height="5.5" rx="1.4" fill="#fff" stroke={INK} strokeWidth="1.1" />
        </g>
      )}
      {species === "parrot" && (
        <g>
          <path d="M32 8c-2-3-6-4-9-3 2.4 1.6 3.6 3.2 4 5z" fill={color} stroke={INK} strokeWidth="1.3" />
          <path d="M34 7c.5-3 3.5-5 6.5-5-1.6 2-2.3 3.7-2.4 5.4z" fill={color} stroke={INK} strokeWidth="1.3" />
          <circle cx="32" cy="36" r="19" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="36.5" cy="30" r="4.4" fill="#fff" />
          <circle cx="37.5" cy="30" r="2.2" fill="#2b2118" />
          <path d="M44 33c5 1.2 7 5 5.6 8.4-1 2.4-4 3.4-6.4 2.4z" fill="#f0d491" stroke={INK} strokeWidth="1.3" />
          <path d="M18 40c3 7 9 10 15 9" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.5" />
        </g>
      )}
      {species === "hamster" && (
        <g>
          <circle cx="17" cy="21" r="6.5" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="47" cy="21" r="6.5" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="17" cy="21" r="3" fill={LIGHT} />
          <circle cx="47" cy="21" r="3" fill={LIGHT} />
          <circle cx="32" cy="37" r="19.5" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="21.5" cy="42" r="6" fill={LIGHT} />
          <circle cx="42.5" cy="42" r="6" fill={LIGHT} />
          <circle cx="25.5" cy="33" r="2.5" fill="#2b2118" />
          <circle cx="38.5" cy="33" r="2.5" fill="#2b2118" />
          <path d="M30 39.5h4l-2 2.4z" fill="#2b2118" opacity="0.75" />
        </g>
      )}
      {species === "fish" && (
        <g>
          <path d="M45 32l11-9c-1.5 6-1.5 12 0 18z" fill={color} stroke={INK} strokeWidth="1.5" />
          <ellipse cx="28" cy="32" rx="19" ry="13.5" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M26 19c4 4 4 9 0 13" stroke={INK} strokeWidth="1.3" fill="none" opacity="0.5" />
          <circle cx="19" cy="29" r="2.6" fill="#2b2118" />
          <circle cx="20" cy="28.2" r="0.8" fill="#fff" />
          <circle cx="52" cy="14" r="2" fill={LIGHT} />
          <circle cx="56" cy="8" r="2.8" fill={LIGHT} />
        </g>
      )}
    </svg>
  );
}
