"use client";

// global-error substitui o layout raiz inteiro quando algo quebra ali
// mesmo (fontes, providers, etc). Ele renderiza seu próprio <html>/<body>
// e não recebe o CSS global, por isso os estilos aqui são inline.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, sans-serif",
          backgroundColor: "#f4f6f9",
          color: "#081729",
        }}
      >
        <div
          style={{
            maxWidth: "360px",
            width: "100%",
            textAlign: "center",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "32px 24px",
            boxShadow: "0 4px 20px rgba(8, 23, 41, 0.08)",
          }}
        >
          <p style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px" }}>
            Algo deu errado
          </p>
          <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 20px" }}>
            Não conseguimos carregar o MontaFácil agora. Tente novamente em
            alguns instantes.
          </p>
          <button
            onClick={() => retry()}
            style={{
              backgroundColor: "#c8963e",
              color: "#0b1a2a",
              border: "none",
              borderRadius: "10px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
