const CACHE_NAME = "montafacil-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pré-cache vazio por enquanto
      return cache.addAll([]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  
  // Passa direto para a rede (sem cache customizado por enquanto), mas
  // precisa chamar respondWith: um handler vazio é tratado como no-op
  // pelo navegador e adiciona overhead a cada navegação sem benefício.
  event.respondWith(fetch(event.request));
});
