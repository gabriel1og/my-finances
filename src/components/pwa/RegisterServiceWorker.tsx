'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registro sem await: falhar aqui não pode atrapalhar o carregamento.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
