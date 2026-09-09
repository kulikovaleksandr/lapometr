import { useState, useEffect } from 'react';
import { Modal, Btn } from './ui';
import { Icon } from './icons';

interface OnboardingTourProps {
  onClose: () => void;
}

const steps = [
  {
    title: 'Добро пожаловать в Лапометр!',
    description: 'Ваш персональный помощник в заботе о питомце. Давайте познакомимся с основными функциями.',
    icon: 'paw',
  },
  {
    title: 'Журнал активностей',
    description: 'Отмечайте все заботы о питомце: кормление, игры, процедуры. Каждое действие приносит лапки!',
    icon: 'book',
  },
  {
    title: 'Дуэль хозяев',
    description: 'Соревнуйтесь с другими хозяевами, кто лучше заботится о питомце. Побеждает тот, кто наберёт больше лапок!',
    icon: 'trophy',
  },
  {
    title: 'Здоровье питомца',
    description: 'Следите за здоровьем: ветпаспорт, график прививок, вес и расходы. Всё в одном месте.',
    icon: 'stetho',
  },
  {
    title: 'Статистика',
    description: 'Анализируйте свою заботу: графики, достижения, регулярность. Узнайте свои сильные стороны!',
    icon: 'chart',
  },
  {
    title: 'Всё готово!',
    description: 'Теперь вы знаете все основные функции. Начните заботиться о питомце и получайте удовольствие!',
    icon: 'heart',
  },
];

export function OnboardingTour({ onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Показываем тур только если пользователь ещё не видел его
    const hasSeenTour = localStorage.getItem('lapometr.onboarding.seen');
    if (!hasSeenTour) {
      setShowTour(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem('lapometr.onboarding.seen', 'true');
    setShowTour(false);
    onClose();
  };

  if (!showTour) return null;

  const step = steps[currentStep];

  return (
    <Modal open={showTour} onClose={handleClose} title="">
      <div className="p-6">
        {/* Прогресс */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-medium text-mute">
            Шаг {currentStep + 1} из {steps.length}
          </span>
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 w-8 rounded-full transition-all ${
                  idx === currentStep
                    ? 'bg-accent'
                    : idx < currentStep
                    ? 'bg-accent/50'
                    : 'bg-bg2'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Контент */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
            <Icon name={step.icon as any} size={40} className="text-accent" />
          </div>
          <h3 className="mb-3 font-display text-xl font-bold">{step.title}</h3>
          <p className="text-sm leading-relaxed text-mute">{step.description}</p>
        </div>

        {/* Кнопки навигации */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Btn variant="ghost" onClick={handlePrev} className="flex-1">
              <Icon name="chev" size={16} className="rotate-180" />
              Назад
            </Btn>
          )}
          <Btn onClick={handleNext} className="flex-1">
            {currentStep === steps.length - 1 ? (
              <>
                Начать
                <Icon name="check" size={16} />
              </>
            ) : (
              <>
                Далее
                <Icon name="chev" size={16} />
              </>
            )}
          </Btn>
        </div>

        {/* Пропустить */}
        {currentStep < steps.length - 1 && (
          <button
            onClick={handleClose}
            className="mt-4 w-full text-center text-sm text-mute hover:text-ink"
          >
            Пропустить тур
          </button>
        )}
      </div>
    </Modal>
  );
}
