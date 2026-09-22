import { useEffect, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function NetworkIndicator() {
  const { isOnline, lastChanged } = useNetworkStatus();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  useEffect(() => {
    if (prevOnline !== isOnline) {
      const toast: Toast = {
        id: Date.now(),
        message: isOnline ? 'Подключение восстановлено' : 'Работа офлайн',
        type: isOnline ? 'success' : 'error'
      };
      
      setToasts(prev => [...prev, toast]);
      setPrevOnline(isOnline);

      // Автоматически удаляем тост через 3 секунды
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 3000);
    }
  }, [isOnline, prevOnline]);

  return (
    <>
      {/* Индикатор в шапке */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.875rem',
          fontWeight: '500',
          backgroundColor: isOnline ? '#d1fae5' : '#fee2e2',
          color: isOnline ? '#065f46' : '#991b1b',
          transition: 'all 0.3s ease'
        }}
        title={isOnline ? 'Подключено к сети' : 'Работа офлайн'}
      >
        <div 
          style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#ef4444'
          }}
        />
        {isOnline ? 'Онлайн' : 'Офлайн'}
      </div>

      {/* Тосты */}
      <div 
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: toast.type === 'success' ? '#065f46' : '#991b1b',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              animation: 'slideIn 0.3s ease-out',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
