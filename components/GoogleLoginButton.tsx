"use client";

import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import { loginGoogleAction } from "@/lib/actions/auth";
import { Alerta } from "@/components/ui";

function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.8 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleLoginButton() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try {
      const resultado = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await resultado.user.getIdToken();
      const resposta = await loginGoogleAction(idToken);
      if (resposta?.error) {
        setErro(resposta.error);
      }
    } catch {
      setErro("Não foi possível entrar com o Google. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <button
        type="button"
        onClick={entrar}
        disabled={carregando}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
      >
        {carregando ? (
          "Entrando…"
        ) : (
          <>
            <IconeGoogle />
            Entrar com Google
          </>
        )}
      </button>
    </div>
  );
}
