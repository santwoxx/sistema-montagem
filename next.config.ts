import type { NextConfig } from "next";

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
};

export default nextConfig;
