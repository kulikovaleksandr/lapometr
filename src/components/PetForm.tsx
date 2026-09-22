import { useRef, useState } from "react";
import { Btn, Field, cx, inputCls } from "./ui";
import { Icon, PetFace } from "./icons";
import { AVATAR_COLORS, SPECIES } from "../lib/data";
import { fileToAvatar } from "../lib/db";
import type { Species } from "../lib/types";

export interface PetFormData {
  name: string;
  species: Species;
  breed: string;
  birthday: string;
  color: string;
  img?: string;
}

export function PetForm({
  onSubmit,
  onCancel,
  submitLabel = "Сохранить",
  autoFocus = true,
}: {
  onSubmit: (data: PetFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("cat");
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [img, setImg] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!name.trim()) { setErr("Как зовут питомца?"); return; }
    setErr(null);
    onSubmit({ name: name.trim(), species, breed: breed.trim(), birthday, color, img });
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {SPECIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSpecies(s.id)}
            className={cx(
              "flex flex-col items-center gap-1 rounded-2xl border p-2.5 transition-all hover:-translate-y-0.5",
              species === s.id ? "border-accent bg-accent-soft" : "border-line hover:border-mute",
            )}
          >
            <PetFace species={s.id} color={color} size={44} />
            <span className={cx("text-[11.5px] font-bold", species === s.id ? "text-ink" : "text-mute")}>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <Field label="Кличка">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Булка" autoFocus={autoFocus} />
        </Field>
        <Field label="Порода (необязательно)">
          <input className={inputCls} value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Британская" />
        </Field>
        <Field label="Дата рождения (необязательно)" hint={birthday ? "Возраст посчитаем сами" : undefined}>
          <input
            className={inputCls} type="date" value={birthday}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <Btn variant="soft" size="md" className="w-full" onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={15} />
            {img ? "Заменить фото" : "Фото питомца"}
          </Btn>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) fileToAvatar(f).then(setImg).catch(() => setErr("Не удалось прочитать изображение"));
            }}
          />
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-2 block text-[12.5px] font-semibold text-mute">Окрас / цвет карточки</span>
        <div className="flex flex-wrap items-center gap-2.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c} onClick={() => setColor(c)} aria-label={`Цвет ${c}`}
              className={cx("h-9 w-9 rounded-full transition-all", color === c && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              style={{ background: c }}
            />
          ))}
          {!img && <PetFace species={species} color={color} size={40} className="ml-2 breathe" />}
        </div>
      </div>

      {err && <p className="anim-fade mt-4 text-[13px] font-medium text-danger">{err}</p>}

      <div className="mt-6 flex gap-3">
        {onCancel && (
          <Btn variant="ghost" onClick={onCancel}>Отмена</Btn>
        )}
        <Btn size="lg" className="flex-1" onClick={submit}>
          <Icon name="paw" size={17} />{submitLabel}
        </Btn>
      </div>
    </div>
  );
}
