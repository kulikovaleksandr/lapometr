import { useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { Btn, Field, UserAvatar, cx, inputCls } from "../components/ui";
import { Icon, Logo } from "../components/icons";
import { PetForm } from "../components/PetForm";
import { AVATAR_COLORS } from "../lib/data";
import { fileToAvatar } from "../lib/db";

export function OnboardingScreen() {
  const { user, updateProfile, createPet, toast } = useApp();
  const [step, setStep] = useState<0 | 1>(0);

  /* хозяин */
  const [name, setName] = useState(user?.name ?? "");
  const [color, setColor] = useState(user?.color ?? AVATAR_COLORS[0]);
  const [img, setImg] = useState<string | undefined>(user?.img);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const next = () => {
    if (!name.trim()) { setErr("Введите имя"); return; }
    setErr(null);
    updateProfile({ name: name.trim(), color, img });
    setStep(1);
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={40} />
        <span className="font-display text-xl font-bold">Лапометр</span>
      </div>

      {/* прогресс */}
      <div className="mb-8 flex w-full max-w-lg items-center gap-3">
        {["Хозяин", "Питомец"].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-3">
            <span
              className={cx(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold transition-all",
                step >= i ? "bg-accent text-accent-ink" : "border border-line text-mute",
              )}
            >
              {step > i ? <Icon name="check" size={15} /> : i + 1}
            </span>
            <span className={cx("text-[13px] font-bold", step >= i ? "text-ink" : "text-mute")}>{s}</span>
            {i === 0 && <span className={cx("h-px flex-1", step > 0 ? "bg-accent" : "bg-line")} />}
          </div>
        ))}
      </div>

      {step === 0 && user && (
        <div className="card anim-fadeup w-full max-w-lg p-7">
          <h1 className="font-display text-[22px] font-bold tracking-tight">Кто будет заботиться?</h1>
          <p className="mt-1 text-[13px] text-mute">Имя увидит второй хозяин в дуэли и журнале</p>

          <div className="mt-6 flex items-center gap-5">
            <UserAvatar user={{ ...user, name: name || "?", color, img }} size={76} />
            <div className="flex-1 space-y-3">
              <Field label="Ваше имя">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Мария" autoFocus />
              </Field>
              <Btn variant="soft" size="sm" onClick={() => fileRef.current?.click()}>
                <Icon name="camera" size={15} />
                {img ? "Заменить фото" : "Загрузить фото"}
              </Btn>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) fileToAvatar(f).then(setImg).catch(() => toast("Не удалось прочитать изображение", "err"));
              }} />
            </div>
          </div>

          <div className="mt-5">
            <span className="mb-2 block text-[12.5px] font-semibold text-mute">Цвет в дуэли и журнале</span>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c} onClick={() => setColor(c)} aria-label={`Цвет ${c}`}
                  className={cx("h-9 w-9 rounded-full transition-all", color === c && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {err && <p className="anim-fade mt-4 text-[13px] font-medium text-danger">{err}</p>}
          <Btn size="lg" className="mt-6 w-full" onClick={next}>
            Дальше: питомец <Icon name="chev" size={17} />
          </Btn>
        </div>
      )}

      {step === 1 && (
        <div className="card anim-fadeup w-full max-w-lg p-7">
          <h1 className="font-display text-[22px] font-bold tracking-tight">Знакомьте с питомцем</h1>
          <p className="mt-1 text-[13px] text-mute">Для него заведём журнал, лапки и напоминания</p>
          <div className="mt-6">
            <PetForm
              onSubmit={(d) => createPet(d)}
              onCancel={() => setStep(0)}
              submitLabel="Завести журнал"
            />
          </div>
        </div>
      )}
    </div>
  );
}
