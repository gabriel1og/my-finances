import type { MetadataRoute } from 'next';

/**
 * Manifest como rota do App Router, não arquivo estático: fica ao lado do
 * resto da configuração e é tipado.
 *
 * `display: standalone` tira a barra do navegador; `orientation: portrait`
 * porque o app instalado é de celular — no desktop ele já roda na aba.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'flowly — Finanças Pessoais',
    short_name: 'flowly',
    description: 'Registro manual de receitas e despesas com orçamento base zero.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F1117',
    theme_color: '#0F1117',
    lang: 'pt-BR',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // O maskable tem margem maior: o Android recorta o ícone em círculo ou
      // squircle conforme o launcher.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Novo lançamento', url: '/transactions' },
      { name: 'Lançamentos fixos', url: '/recurring' },
      { name: 'Previsão', url: '/forecast' },
    ],
  };
}
