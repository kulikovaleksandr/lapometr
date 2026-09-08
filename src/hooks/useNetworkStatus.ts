import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  lastChanged: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    lastChanged: Date.now()
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus({ isOnline: true, lastChanged: Date.now() });
    };

    const handleOffline = () => {
      setStatus({ isOnline: false, lastChanged: Date.now() });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
