# MontaFácil — Sistema de gestão para montadores de móveis

Sistema simples para organizar as demandas (montagens) e as finanças de uma
empresa de montagem de móveis, com um painel para o administrador e um painel
individual para cada montador.

## O que o sistema faz

**Painel do administrador**
- Cadastra e gerencia os montadores da equipe (cria login e senha de cada um).
- Cadastra as lojas parceiras que enviam pedidos.
- Define a porcentagem de comissão de cada montador, individualmente por loja.
- Cria e atribui montagens a um montador específico (ou deixa "a definir").
- Importa uma nota fiscal para preencher uma montagem nova sozinho: aceita o
  XML da NFe ou uma foto/imagem da nota impressa (a leitura da foto é feita
  por OCR direto no navegador, sem custo). Se a loja da nota ainda não
  estiver cadastrada, o sistema cadastra ela automaticamente.
- Acompanha o status de cada montagem (pendente, em andamento, concluída).
- Controla os pagamentos: se a loja já pagou a empresa e se o montador já
  recebeu sua comissão.
- Tem uma tela financeira com totais por mês, por loja e por montador.

**Painel do montador**
- Vê apenas as montagens atribuídas a ele.
- Ao abrir uma montagem, vê o endereço do cliente (com link direto para o
  mapa), telefone (com botão de ligar e de WhatsApp), o serviço a ser feito
  e o valor da sua comissão.
- Pode marcar a montagem como "iniciada" e depois "concluída".
- Tem uma tela financeira própria mostrando quanto já ganhou, quanto está
  pendente de pagamento e o histórico de montagens concluídas.

## Como rodar o sistema no seu computador

Pré-requisitos:
- [Node.js](https://nodejs.org) instalado (versão 18 ou superior).
- Um banco de dados Postgres na nuvem (gratuito). Recomendado: crie uma conta
  em [neon.com](https://neon.com), crie um projeto e copie as duas strings de
  conexão (pooled e direct) para o arquivo `.env` do projeto, nas variáveis
  `DATABASE_URL` e `DIRECT_URL`.

```bash
cd sistema-montador
npm install                       # instala as dependências (só precisa fazer uma vez)
npx prisma migrate deploy         # cria as tabelas no banco (só precisa fazer uma vez)
npm run db:seed                   # cria o usuário administrador padrão
npm run dev                        # inicia o sistema
```

Depois abra **http://localhost:3000** no navegador.

### Primeiro acesso

- **Administrador:** entra com o botão "Entrar com Google" — só funciona para
  e-mails autorizados (veja a seção do Firebase abaixo).
- **Montador:** entra com e-mail e senha, cadastrados pelo administrador no
  painel.

O sistema também vem com um usuário administrador de backup
(`admin@montafacil.com`), caso o login com Google dê algum problema. Como
este repositório é público, a senha dele **não fica escrita aqui** — pergunte
a quem administra o sistema, ou gere uma nova rodando:

```bash
npx tsx prisma/seed.ts
```

(isso só recria a senha se o usuário ainda não existir; para trocar a senha
de um admin existente, use `npx prisma studio` ou peça para gerarem uma nova).

A partir daí, use o painel para cadastrar lojas, montadores e comissões — tudo
pela própria interface, sem precisar mexer em código.

## Login do administrador com Google (Firebase)

O login do administrador usa o Google, mas só deixa entrar quem estiver na
lista de e-mails autorizados **escrita direto nas regras do Firestore**
(arquivo `firestore.rules` deste projeto). Passo a passo no [console do
Firebase](https://console.firebase.google.com), no projeto
`sistema-montagem-92126`:

1. **Ativar o login com Google:** Authentication → Sign-in method → ative o
   provedor "Google".
2. **Criar o banco Firestore:** Firestore Database → Criar banco de dados
   (pode escolher qualquer região, modo produção).
3. **Criar um documento fixo:** na aba "Dados" do Firestore, crie a coleção
   `adminEmails` com um único documento de ID `check` (sem precisar de
   nenhum campo dentro — só precisa existir). Esse documento é só um
   "alvo" para a checagem; quem decide se o login passa é a regra abaixo,
   não esse documento.
4. **Colar as regras de segurança:** na aba "Regras", cole o conteúdo do
   arquivo `firestore.rules` deste projeto e clique em **"Publicar"** (só
   colar o texto no editor não ativa nada). Para autorizar mais alguém no
   futuro, edite a lista de e-mails dentro do arquivo e publique de novo.
5. **Domínios autorizados:** em Authentication → Settings → Authorized
   domains, `localhost` já vem liberado. Depois do deploy, adicione o
   domínio do Vercel (ex: `seusistema.vercel.app`) nessa lista, senão o
   login com Google não funciona em produção.

Quem não estiver na lista de e-mails escrita nas regras tem o login com
Google recusado — mesmo com uma conta Google válida.

### Se precisar recriar o usuário administrador

Se apagar o banco de dados ou quiser recriar o admin padrão:

```bash
npm run db:seed
```

## Sobre o banco de dados

Os dados ficam guardados num banco Postgres na nuvem (ex: Neon), não em um
arquivo local — assim o mesmo banco funciona tanto no seu computador quanto
no site publicado no Vercel. Para visualizar/editar os dados diretamente (uma
planilha visual), rode:

```bash
npx prisma studio
```

**Importante:** o provedor do banco (Neon, Supabase, etc.) já cuida de
backups automáticos, mas vale a pena checar as opções de backup do provedor
escolhido — é lá que fica todo o histórico financeiro da empresa.

## Publicando o sistema no Vercel

Com o banco Postgres já configurado no `.env`, o deploy é feito subindo este
projeto (pasta `sistema-montador`) para o Vercel — pela CLI (`vercel`) ou
conectando um repositório do GitHub. As mesmas variáveis `DATABASE_URL`,
`DIRECT_URL` e `SESSION_SECRET` do `.env` precisam ser cadastradas nas
"Environment Variables" do projeto no Vercel. Depois disso, o link gerado
(ex: `seusistema.vercel.app`) já funciona tanto para o admin quanto para os
montadores, em qualquer dispositivo com internet.

## Estrutura do projeto (para referência técnica)

- `prisma/schema.prisma` — modelo do banco de dados (usuários, lojas,
  comissões, montagens).
- `lib/auth.ts` — login, sessão e proteção de acesso por papel (admin/montador).
- `lib/actions/` — as ações do sistema (criar montador, criar montagem,
  marcar pagamento, etc).
- `app/admin/` — todas as telas do painel do administrador.
- `app/montador/` — todas as telas do painel do montador.
- `components/` — componentes visuais reutilizados nas telas.
