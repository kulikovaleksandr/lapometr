import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state/AppContext";
import { ThemeSwitcher, Toaster } from "./components/ui";
import { Icon } from "./components/icons";
import { AuthScreen } from "./screens/Auth";
import { OnboardingScreen } from "./screens/Onboarding";
import { HomeScreen } from "./screens/Home";
import { DuelScreen } from "./screens/Duel";
import { JournalScreen } from "./screens/Journal";
import { StatsScreen } from "./screens/Stats";
import { VetScreen } from "./screens/Vet";
import { SettingsScreen } from "./screens/Settings";

export type Tab = "home" | "duel" | "journal" | "stats" | "vet" | "settings";

const TABS: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { id: "home", label: "Дом", icon: "home" },
  { id: "duel", label: "Дуэль", icon: "trophy" },
  { id: "journal", label: "Журнал", icon: "book" },
  { id: "stats", label: "Статы", icon: "chart" },
  { id: "vet", label: "Вет", icon: "stetho" },
  { id: "settings", label: "Ещё", icon: "gear" },
];

function Shell() {
  const { user, pet, toast } = useApp();
  const [tab, setTab] = useState<Tab>("home");

  // при выходе / смене пользователя возвращаемся на «дом»
  useEffect(() => { setTab("home"); }, [user?.id]);

  if (!user) return <AuthScreen />;
  if (!pet) return <OnboardingScreen />;

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
      .then(() => toast("Код приглашения скопирован", "ok"))
      .catch(() => toast(`Код: ${code}`, "info"));
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* верхняя шапка (Фаза 8.1): бренд + переключатель 5 тем */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2.5">
          <button
            onClick={() => setTab("home")}
            className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[14px] font-extrabold tracking-tight transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <Icon name="paw" size={18} className="text-accent" />
            <span className="font-display">Лапомер</span>
          </button>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5">
        {tab === "home" && <HomeScreen onNav={setTab} />}
        {tab === "duel" && <DuelScreen onCopy={copyCode} />}
        {tab === "journal" && <JournalScreen />}
        {tab === "stats" && <StatsScreen />}
        {tab === "vet" && <VetScreen />}
        {tab === "settings" && <SettingsScreen onCopy={copyCode} />}
      </main>

      {/* нижняя навигация */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-stretch justify-between px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold transition-colors " +
                (tab === t.id ? "text-accent" : "text-mute hover:text-ink")
              }
              aria-current={tab === t.id ? "page" : undefined}
            >
              <Icon name={t.icon} size={20} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
      <Toaster />
    </AppProvider>
  );
}
