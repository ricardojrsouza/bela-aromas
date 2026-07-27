// Service Worker mínimo — só para permitir "Instalar app".
// O painel (Decap CMS) sempre precisa de internet para funcionar de verdade
// (ele conversa direto com o GitHub), então aqui não guardamos nada em cache,
// só deixamos as requisições passarem normalmente.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
