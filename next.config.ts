import type { NextConfig } from "next";

// Cabeçalhos aplicados a todas as respostas. São os "de sempre", que não
// dependem de conhecer o conteúdo da página -- de propósito não há
// Content-Security-Policy aqui: o sistema carrega Firebase Auth, o mapa
// embutido do Google e o OCR (tesseract.js, que usa worker e WebAssembly),
// e uma CSP escrita no chute quebraria login, rota e importação de nota de
// uma vez. Fica como passo seguinte, para ser feita medindo o que cada
// tela realmente carrega.
const CABECALHOS_SEGURANCA = [
  // Impede que o sistema seja embutido em iframe de outro site
  // (clickjacking): nenhuma tela daqui precisa ser embutida.
  { key: "X-Frame-Options", value: "DENY" },
  // Navegador não "adivinha" o tipo do arquivo servido.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ao sair para o Google Maps, o WhatsApp ou o CentralSync, manda só a
  // origem -- nunca o caminho, que carrega o id da montagem.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nada aqui usa câmera via API do navegador (a foto entra por
  // <input type="file">), microfone, geolocalização ou pagamento.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O padrão do Next é 1 MB e todo upload do sistema (foto do produto
      // montado + as duas assinaturas, foto de ocorrência, foto de perfil,
      // manual da montagem) passa por Server Action. Foto de celular não
      // cabe em 1 MB: o pedido era recusado antes de chegar na action e a
      // tela caía no "Algo deu errado", sem salvar nada.
      //
      // As imagens já sobem reduzidas pelo navegador (lib/imagem.ts), então
      // 4 MB é folga — e é o máximo aproveitável: no Vercel, a função
      // recusa qualquer corpo acima de ~4,5 MB antes do Next ver o pedido.
      bodySizeLimit: "4mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: CABECALHOS_SEGURANCA,
      },
      {
        // A página de avaliação é pública (o cliente abre por um link de
        // WhatsApp, sem login). Não deve aparecer em busca.
        source: "/avaliar/:id",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
