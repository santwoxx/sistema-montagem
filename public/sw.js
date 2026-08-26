// Service worker do MontaFácil.
//
// O que ele faz e, principalmente, o que NÃO faz.
//
// Antes daqui existia um service worker que abria um cache vazio e tinha um
// listener de fetch que só dava `return` -- ou seja, instalava-se para
// satisfazer o requisito de PWA e não entregava nada. Como o montador
// trabalha na rua, com sinal ruim, o que faltava era justamente o offline.
//
// A regra de ouro: **nenhuma página HTML é guardada em cache**. Toda tela
// deste sistema é montada no servidor com os dados de quem está logado --
// guardar isso significaria mostrar a montagem de uma pessoa para outra que
// usasse o mesmo aparelho, ou mostrar valores financeiros vencidos como se
// fossem atuais. Navegação é sempre rede primeiro; se a rede falhar, cai
// numa página estática de "sem conexão", nunca numa cópia antiga da tela.
//
// O que é guardado: só arquivo estático de conteúdo imutável -- o que o
// Next publica em /_next/static/ (o nome do arquivo já carrega o hash do
// conteúdo, então nunca fica velho) e os ícones do aplicativo. É isso que
// faz o app abrir rápido e não ficar em branco no sinal fraco.

const VERSAO = "v2";
const CACHE_ESTATICO = `montafacil-estatico-${VERSAO}`;
const PAGINA_OFFLINE = "/offline.html";

const PRECARREGAR = [PAGINA_OFFLINE, "/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_ESTATICO);
      // addAll falha inteiro se um item falhar; aqui um ícone ausente não
      // pode impedir a instalação do resto.
      await Promise.all(
        PRECARREGAR.map((url) => cache.add(url).catch(() => {}))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove os caches das versões anteriores -- sem isto eles ficariam
      // ocupando espaço no aparelho para sempre.
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith("montafacil-") && nome !== CACHE_ESTATICO)
          .map((nome) => caches.delete(nome))
      );
      await self.clients.claim();
    })()
  );
});

function ehEstaticoImutavel(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.json" ||
    /^\/icon-\d+\.png$/.test(url.pathname) ||
    /\.(?:svg|woff2?|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET. POST é Server Action (conclusão de montagem, upload de foto) e
  // jamais pode passar por cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nada de outra origem (Vercel Blob, Firebase, Google Maps, WhatsApp) e
  // nada da API -- deixa o navegador cuidar como sempre cuidou.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (ehEstaticoImutavel(url)) {
    // Cache primeiro: o nome do arquivo muda a cada build, então o que
    // está guardado nunca é a versão errada.
    event.respondWith(
      (async () => {
        const guardado = await caches.match(request);
        if (guardado) return guardado;
        try {
          const resposta = await fetch(request);
          if (resposta.ok) {
            const cache = await caches.open(CACHE_ESTATICO);
            cache.put(request, resposta.clone()).catch(() => {});
          }
          return resposta;
        } catch (erro) {
          // Sem rede e sem cópia guardada: devolve o erro para o navegador
          // tratar como trataria sem service worker nenhum.
          throw erro;
        }
      })()
    );
    return;
  }

  // Navegação (abrir uma tela): rede sempre. O offline é o último recurso e
  // é uma página estática, nunca a tela de outra pessoa.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const offline = await caches.match(PAGINA_OFFLINE);
          return (
            offline ??
            new Response("Sem conexão.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // Todo o resto (dados do App Router, imagens de montagem, etc.) segue
  // direto para a rede, sem passar por aqui.
});
