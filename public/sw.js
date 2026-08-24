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
  // Apenas manter o listener vazio é o suficiente para satisfazer os
  // requisitos de instalação do PWA (manifest). 
  // O navegador continuará fazendo todas as requisições pela rede normalmente.
  return;
});
