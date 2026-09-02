import { FormEvent, useState } from "react";
import { useApp } from "../state/AppContext";
import { Btn, Field, cx, inputCls } from "../components/ui";
import { Icon, Logo } from "../components/icons";
import type { IconName } from "../lib/types";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "book", title: "Журнал-шкала", text: "Каждая забота — кружок на временной линии питомца" },
  { icon: "paw", title: "Лапки и уровни", text: "Баллы за покормил, погладил, поменял лоток" },
  { icon: "trophy", title: "Дуэль хозяев", text: "Кто заботится лучше и регулярнее — видно сразу" },
  { icon: "bell", title: "Напоминания", text: "«Пора покормить» и «поменять воду» — вовремя" },
];

export function AuthScreen() {
  const { register, login, loginDemo, guest } = useApp();
  const [mode, setMode] = useState<"login" | "reg">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = mode === "login" ? login(email, pass) : register(email, pass, name);
    if (r) { setErr(r); setShake((s) => s + 1); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---- Левая брендовая панель ---- */}
      <aside className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(700px 420px at 15% 0%, var(--glow1), transparent 70%), radial-gradient(600px 400px at 90% 100%, var(--glow2), transparent 70%)" }}
        />
        {[
          { t: "8%", l: "12%", s: 26, d: "0s" }, { t: "22%", l: "78%", s: 18, d: "1.2s" },
          { t: "48%", l: "8%", s: 16, d: "0.6s" }, { t: "64%", l: "86%", s: 24, d: "1.8s" },
          { t: "82%", l: "30%", s: 20, d: "0.9s" }, { t: "12%", l: "48%", s: 14, d: "2.2s" },
        ].map((p, i) => (
          <span key={i} className="floaty pointer-events-none absolute text-mute/25" style={{ top: p.t, left: p.l, animationDelay: p.d }}>
            <Icon name="paw" size={p.s} />
          </span>
        ))}

        <div className="relative flex items-center gap-3">
          <Logo size={44} />
          <span className="font-display text-2xl font-bold tracking-tight">Лапометр</span>
        </div>

        <div className="relative max-w-lg">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
            журнал заботы о питомце
          </p>
          <h1 className="mt-4 font-display text-[42px] font-extrabold leading-[1.08] tracking-tight">
            Каждая лапка —<br />на счету
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mute">
            Отмечайте кормления, прививки и поглаживания. Следите, кто из хозяев
            сегодня главный заботник — и не пропускайте важные процедуры.
          </p>
          <ul className="mt-9 space-y-4">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="anim-fadeup flex items-start gap-3.5" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon name={f.icon} size={18} />
                </span>
                <span>
                  <span className="block text-[14px] font-bold">{f.title}</span>
                  <span className="block text-[13px] text-mute">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12.5px] text-mute/80">
          Работает с ПК и телефона, без установки · данные хранятся в вашем браузере
        </p>
      </aside>

      {/* ---- Правая панель: форма ---- */}
      <main className="flex items-center justify-center bg-bg2/40 px-4 py-10">
        <div key={shake} className={cx("w-full max-w-[420px]", shake > 0 && "anim-wiggle")}>
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <span className="font-display text-xl font-bold">Лапометр</span>
          </div>

          <div className="card anim-fadeup p-7">
            <h2 className="font-display text-[22px] font-bold tracking-tight">
              {mode === "login" ? "С возвращением" : "Создать аккаунт"}
            </h2>
            <p className="mt-1 text-[13px] text-mute">
              {mode === "login" ? "Питомец уже заждался" : "Займёт меньше минуты"}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-bg2 p-1">
              {(["login", "reg"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setErr(null); }}
                  className={cx(
                    "rounded-lg py-2 text-[13px] font-bold transition-all",
                    mode === m ? "bg-surface text-ink shadow-sm" : "text-mute hover:text-ink",
                  )}
                >
                  {m === "login" ? "Вход" : "Регистрация"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3.5">
              {mode === "reg" && (
                <Field label="Как вас зовут?">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Мария" />
                </Field>
              )}
              <Field label="E-mail">
                <input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Field label="Пароль">
                <input className={inputCls} type="password" required value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Минимум 4 символа" />
              </Field>
              {err && (
                <p className="anim-fade flex items-start gap-2 rounded-xl bg-danger/12 px-3 py-2.5 text-[13px] font-medium text-danger">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0" />{err}
                </p>
              )}
              <Btn type="submit" size="lg" className="w-full">
                {mode === "login" ? "Войти" : "Начать заботиться"}
                <Icon name="paw" size={17} />
              </Btn>
            </form>

            <div className="my-5 flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-wider text-mute/70">
              <span className="h-px flex-1 bg-line" />или<span className="h-px flex-1 bg-line" />
            </div>

            <div className="space-y-2.5">
              <Btn variant="outline" className="w-full" onClick={loginDemo}>
                <Icon name="spark" size={16} className="text-accent" />
                Демо-режим: питомец и 30 дней истории
              </Btn>
              <Btn variant="ghost" className="w-full" onClick={guest}>
                Посмотреть как гость
              </Btn>
            </div>
          </div>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-mute/80">
            Демо-доступ: demo@lapometr.app · demo123<br />
            Локальный режим: данные и аккаунт живут в этом браузере
          </p>
        </div>
      </main>
    </div>
  );
}
