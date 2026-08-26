"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (ver public/sw.js).
 *
 * Era um <script dangerouslySetInnerHTML> no layout raiz. Virou componente
 * por dois motivos: script embutido no HTML é a primeira coisa que uma
 * Content-Security-Policy bloqueia (e ela está no caminho), e aqui dá para
 * tratar a falha em vez de deixar a promessa rejeitada solta no console.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Espera a página terminar de carregar: registrar antes disso disputa
    // banda com o que a tela precisa para aparecer -- e no celular na rua
    // essa banda é justamente o que está faltando.
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch((erro) => {
        console.warn("Não foi possível registrar o service worker:", erro);
      });
    };

    if (document.readyState === "complete") {
      registrar();
      return;
    }

    window.addEventListener("load", registrar);
    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
