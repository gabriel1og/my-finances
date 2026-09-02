/* flowly — service worker mínimo.
 *
 * Sem cache de dados: tudo aqui vem do Supabase e ficar servindo saldo velho
 * é pior do que não abrir. O SW existe para o app ser instalável e para dar
 * uma página decente quando o usuário abre offline.
 *
 * Estratégia: network-first para navegação, com fallback para a casca offline.
 */
const CACHE = 'flowly-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só navegação: requisição de dados nunca deve vir do cache.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error()),
    ),
  );
});
