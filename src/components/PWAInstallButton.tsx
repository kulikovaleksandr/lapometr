import { usePWA } from '../hooks/usePWA';

interface PWAInstallButtonProps {
  className?: string;
}

export function PWAInstallButton({ className = '' }: PWAInstallButtonProps) {
  const { isInstalled, canInstall, install } = usePWA();

  // Не показываем кнопку, если приложение уже установлено или установка недоступна
  if (isInstalled || !canInstall) {
    return null;
  }

  return (
    <button
      onClick={install}
      className={`px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors ${className}`}
      aria-label="Установить приложение"
    >
      <span className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Установить
      </span>
    </button>
  );
}
