import { useState } from "react";
import { AppProvider, useApp } from "./state/AppContext";
import { AuthScreen } from "./screens/Auth";
import { OnboardingScreen } from "./screens/Onboarding";
import { HomeScreen } from "./screens/Home";
import { JournalScreen } from "./screens/Journal";
import { DuelScreen } from "./screens/Duel";
import { StatsScreen } from "./screens/Stats";
import { SettingsScreen } from "./screens/Settings";
import { Icon, Logo } from "./components/icons";
import { UserAvatar, cx } from "./components/ui";
import { THEMES } from "./lib/types";
import type { IconName } from "./lib/types";
import { computeDue } from "./lib/db";

export type Tab = "home" | "journal" | "duel" | "stats" | "settings";

const NAV: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Сегодня", icon: "home" },
  { id: "journal", label: "Журнал", icon: "book" },
  { id: "duel", label: "Дуэль", icon: "trophy" },
  { id: "stats", label: "Статистика", icon: "chart" },
  { id: "settings", label: "Настройки", icon: "gear" },
];

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}

function Root() {
  const { user, pet } = useApp();
  if (!user) {
    return (
      <>
        <BackgroundFX />
        <div className="relative z-10"><AuthScreen /></div>
      </>
    );
  }
  if (!pet) {
    return (
      <>
        <BackgroundFX />
        <div className="relative z-10"><OnboardingScreen /></div>
      </>
    );
  }
  return <Shell />;
}

function Shell() {
  const { user, pet, acts, logs, now, theme, setTheme, logout, toasts, dismissToast, toast } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [menu, setMenu] = useState(false);

  const overdueN = computeDue(acts, logs, now).filter((d) => d.overdueMin === null || d.overdueMin > 0).length;

  const copy = (code: string) => {
    const done = () => toast(`Код ${code} скопирован`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done).catch(done);
    else done();
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-10">
      <BackgroundFX />

      {/* ---- Шапка ---- */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <button onClick={() => setTab("home")} className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="font-display text-[17px] font-extrabold tracking-tight">Лапометр</span>
          </button>
          {pet && (
            <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-raise px-3 py-1 text-[12px] font-bold text-mute sm:flex">
              <Icon name="paw" size={13} className="text-accent" />{pet.name}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* темы */}
            <div className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 md:flex" title="Тема оформления">
              {THEMES.map((t) => (
                <button
                  key={t.id} onClick={() => setTheme(t.id)} aria-label={`Тема ${t.name}`}
                  className={cx("h-5 w-5 rounded-full border transition-all hover:scale-110", theme === t.id ? "scale-110 border-ink/50 ring-2 ring-accent/60" : "border-black/10")}
                  style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.swatch} 50%)` }}
                />
              ))}
            </div>

            {/* напоминания */}
            <button
              onClick={() => setTab("home")}
              className="relative rounded-xl border border-line bg-surface p-2.5 text-mute transition hover:text-accent"
              title={overdueN > 0 ? `Пора позаботиться: ${overdueN}` : "Напоминания"}
            >
              <Icon name="bell" size={17} />
              {overdueN > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-danger px-1 font-display text-[10px] font-bold text-white" style={{ height: 18 }}>
                  {overdueN}
                </span>
              )}
            </button>

            {/* пользователь */}
            {user && (
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pr-2.5 transition hover:border-mute">
                  <UserAvatar user={user} size={26} />
                  <Icon name="chev" size={14} className={cx("text-mute transition-transform", menu && "rotate-90")} />
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                    <div className="card anim-pop absolute right-0 z-50 mt-2 w-52 overflow-hidden p-1.5">
                      <div className="border-b border-line px-3 py-2.5">
                        <p className="truncate text-[13.5px] font-bold">{user.name}</p>
                        <p className="truncate text-[12px] text-mute">{user.email}</p>
                      </div>
                      <button onClick={() => { setTab("settings"); setMenu(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-mute transition hover:bg-raise hover:text-ink">
                        <Icon name="gear" size={16} />Настройки
                      </button>
                      <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-mute transition hover:bg-danger/12 hover:text-danger">
                        <Icon name="out" size={16} />Выйти
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---- Каркас ---- */}
      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 px-4 pt-6 lg:grid-cols-[200px_1fr]">
        {/* сайдбар (desktop) */}
        <nav className="sticky top-[80px] hidden h-fit lg:block">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setTab(n.id)}
                  className={cx(
                    "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-bold transition-all",
                    tab === n.id ? "bg-accent text-accent-ink shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_30%,transparent)]" : "text-mute hover:bg-raise hover:text-ink",
                  )}
                >
                  <Icon name={n.icon} size={18} className={cx("transition-transform", tab !== n.id && "group-hover:scale-110")} />
                  {n.label}
                  {n.id === "home" && overdueN > 0 && tab !== "home" && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-danger" style={{ animation: "pulse-dot 1.6s infinite" }} />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="card mt-5 p-4">
            <p className="font-display text-[12px] font-bold text-mute">Подсказка</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-mute">
              Откройте вторую вкладку, войдите как второй хозяин и введите код — дуэль оживёт.
            </p>
          </div>
        </nav>

        {/* контент */}
        <main key={tab} className="anim-fadeup min-w-0">
          {tab === "home" && <HomeScreen onNav={setTab} />}
          {tab === "journal" && <JournalScreen />}
          {tab === "duel" && <DuelScreen onCopy={copy} />}
          {tab === "stats" && <StatsScreen />}
          {tab === "settings" && <SettingsScreen onCopy={copy} />}
          <footer className="mt-10 border-t border-line pt-5 text-center text-[12px] text-mute/80">
            Лапометр · журнал заботы, лапки и честные дуэли · v1.0 MVP
          </footer>
        </main>
      </div>

      {/* ---- Нижняя навигация (mobile) ---- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => (
            <button
              key={n.id} onClick={() => setTab(n.id)}
              className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition-colors", tab === n.id ? "text-accent" : "text-mute")}
            >
              <Icon name={n.icon} size={20} />
              {n.label}
              {tab === n.id && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
              {n.id === "home" && overdueN > 0 && tab !== "home" && (
                <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-danger" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ---- Тосты ---- */}
      <div className="fixed right-4 top-20 z-[80] flex w-[min(92vw,340px)] flex-col gap-2">
        {toasts.map((t) => (
          <button
            key={t.id} onClick={() => dismissToast(t.id)}
            className="card anim-slide flex items-center gap-3 px-4 py-3 text-left"
          >
            <span className={cx(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              t.kind === "paw" && "bg-accent-soft text-accent",
              t.kind === "ok" && "bg-ok/15 text-ok",
              t.kind === "warn" && "bg-warn/15 text-warn",
              t.kind === "err" && "bg-danger/15 text-danger",
            )}>
              <Icon name={t.kind === "paw" ? "paw" : t.kind === "ok" ? "check" : "alert"} size={16} />
            </span>
            <span className="text-[13px] font-semibold leading-snug">{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---- Живой фон: свечения + следы лап ---- */
const PAWS = [
  { t: "6%", l: "4%", s: 26, r: -20 }, { t: "14%", l: "88%", s: 20, r: 15 },
  { t: "26%", l: "12%", s: 16, r: 30 }, { t: "34%", l: "78%", s: 28, r: -10 },
  { t: "48%", l: "5%", s: 22, r: 10 }, { t: "55%", l: "92%", s: 18, r: -25 },
  { t: "66%", l: "15%", s: 18, r: 20 }, { t: "74%", l: "85%", s: 24, r: 5 },
  { t: "85%", l: "8%", s: 20, r: -15 }, { t: "92%", l: "70%", s: 16, r: 25 },
  { t: "20%", l: "45%", s: 14, r: -30 }, { t: "60%", l: "50%", s: 14, r: 18 },
];

function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(900px 500px at 12% -5%, var(--glow1), transparent 65%), radial-gradient(800px 500px at 95% 105%, var(--glow2), transparent 65%)" }}
      />
      {PAWS.map((p, i) => (
        <span
          key={i}
          className="absolute text-ink"
          style={{ top: p.t, left: p.l, opacity: 0.04, transform: `rotate(${p.r}deg)` }}
        >
          <Icon name="paw" size={p.s} />
        </span>
      ))}
    </div>
  );
}
