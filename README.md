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
- Monta a **rota do dia**: lista os endereços dos clientes agendados na ordem
  da agenda e abre tudo de uma vez no Google Maps (com ponto de partida
  opcional). Também dá para filtrar por montador e mandar a rota pronta para
  ele por WhatsApp.
- Controla os pagamentos: se a loja já pagou a empresa e se o montador já
  recebeu sua comissão.
- Anexa o comprovante de qualquer montagem (foto do produto montado e, se
  quiser, as assinaturas), no card "Comprovante de conclusão" da tela da
  montagem. É por aí que entram as fotos das montagens feitas pela própria
  empresa, que não têm montador para enviar pelo aplicativo.
- Tem uma tela financeira com totais por mês, por loja e por montador.

**Painel do montador**
- Vê apenas as montagens atribuídas a ele.
- Ao abrir uma montagem, vê o endereço do cliente (com link direto para o
  mapa), telefone (com botão de ligar e de WhatsApp), o serviço a ser feito
  e o valor da sua comissão.
- Pode marcar a montagem como "iniciada" e depois "concluída".
- Ao concluir, envia o comprovante do serviço: foto do produto montado (tirada
  na hora ou escolhida da galeria) mais a assinatura dele e a do cliente. As
  fotos são reduzidas no próprio celular antes de subir, então funcionam mesmo
  com internet fraca.
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
npm install                       # instala as dependências (só precisa fazer uma vez)
npm run db:migrate                # cria as tabelas no banco (só precisa fazer uma vez)
npm run db:seed                   # cria o usuário administrador padrão
npm run dev                       # inicia o sistema
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

## Conferindo o sistema antes de publicar

```bash
npm test        # testes das regras de negócio, datas e leitura de nota fiscal
npm run lint    # confere o padrão do código
npm run build   # compila tudo, como o Vercel faz
```

Os testes (pasta `testes/`) cobrem a parte do sistema que não depende de
banco nem de tela: as contas de dinheiro, os limites de mês e de dia no fuso
de Itabuna, a leitura do XML da nota e do texto lido por OCR do DANFE, e as
validações do que chega de fora. É por eles que se percebe uma quebra antes
de ela chegar no celular de quem está na rua.

## Sobre datas e fuso horário

O servidor do Vercel roda em UTC, três horas à frente de Itabuna. Para o mês
e o dia não escorregarem por causa disso (uma montagem concluída às 22h
aparecendo com a data do dia seguinte, ou caindo no mês errado na virada), o
sistema não usa o fuso do servidor: ele calcula tudo em
`America/Sao_Paulo`, de forma explícita, em `lib/datas.ts`. Não é preciso
configurar variável nenhuma para isso funcionar.

## Publicando o sistema no Vercel

Com o banco Postgres já configurado no `.env`, o deploy é feito subindo este
projeto para o Vercel — pela CLI (`vercel`) ou
conectando um repositório do GitHub. As mesmas variáveis `DATABASE_URL`,
`DIRECT_URL` e `SESSION_SECRET` do `.env` precisam ser cadastradas nas
"Environment Variables" do projeto no Vercel. Depois disso, o link gerado
(ex: `seusistema.vercel.app`) já funciona tanto para o admin quanto para os
montadores, em qualquer dispositivo com internet.

As migrações do banco são aplicadas no início do build, por
`scripts/preparar-banco.mjs`. **Deploy de preview não aplica migração nem
seed**: como o preview usa as mesmas variáveis de ambiente do projeto, ele
apontaria para o banco de produção, e abrir um preview só para conferir uma
tela acabaria mudando o banco de verdade.

### Armazenamento das fotos (obrigatório)

As fotos (produto montado, ocorrência, perfil) e os manuais não ficam no banco
— ficam no **Vercel Blob**. No painel do Vercel, aba **Storage**, crie um Blob
Store e conecte ao projeto. Isso cadastra sozinho a variável
`BLOB_READ_WRITE_TOKEN`; se estiver rodando fora do Vercel, copie essa variável
para o `.env`.

Sem essa variável **nenhuma foto sobe**: o sistema avisa na tela que o
armazenamento não está configurado (antes disso a tela simplesmente quebrava,
sem dizer o motivo).

Cada arquivo enviado pode ter até **3 MB**. As fotos são reduzidas no navegador
antes de subir, então na prática nunca chegam perto disso; o limite pesa mesmo
é para PDF de manual, que precisa ser enviado já reduzido.

## Integração com o CentralSync (loja Central Móveis)

O CentralSync é o sistema da loja. A ligação entre os dois é de mão dupla:

1. **Loja → MontaFácil.** Quando a loja designa um pedido para o Dário, o
   CentralSync envia os dados para a fila de "Notas pendentes"
   (`app/api/notas-pendentes/route.ts`). Só vira montagem quando alguém aqui
   revisa e salva. O pedido chega com o número no formato `del-…`, que é o id
   da entrega lá — é por ele que os dois sistemas se reconhecem.
2. **MontaFácil → Loja.** Quando o funcionário conclui a montagem no
   aplicativo (foto do produto + assinatura dele e do cliente), **nada é
   enviado para a loja ainda**. A montagem entra na fila "Prontas para enviar
   ao CentralSync", no painel geral do admin, com a miniatura da foto e o nome
   de quem montou. O admin confere e clica em **"Enviar ao CentralSync"** —
   esse é o único caminho pelo qual a conclusão sai daqui. O mesmo botão fica
   na tela da montagem, e serve também para reenviar (do outro lado o aviso é
   gravado pelo id da entrega, então reenviar sobrescreve em vez de duplicar).

   Lá no CentralSync isso também **não** marca a entrega como montada na hora:
   aparece na caixa flutuante "Montagens Feitas" da aba Entregas &
   Assinaturas, e um administrador da loja confere e confirma.

   Se faltar a foto ou alguma assinatura (por exemplo, quando a montagem foi
   marcada como concluída direto pelo painel, sem passar pelo aplicativo do
   montador), o envio é recusado com o aviso do que está faltando — em vez de
   mandar um comprovante vazio para a loja. Nesse caso, use o card
   "Comprovante de conclusão" na tela da montagem para anexar o que falta: ele
   aceita a foto e as assinaturas de qualquer montagem, inclusive das feitas
   pela própria empresa.

Para isso funcionar, além das variáveis do banco, o projeto precisa de duas
chaves nas "Environment Variables":

- `CENTRALSYNC_API_KEY` — chave que o CentralSync usa para **entregar** notas
  pendentes aqui.
- `MONTAFACIL_TO_CENTRALSYNC_KEY` — chave usada para **avisar** o CentralSync
  da montagem concluída. Precisa ser igual ao segredo `MONTAFACIL_API_KEY`
  cadastrado no Firebase do CentralSync (`firebase functions:secrets:set
  MONTAFACIL_API_KEY`). São chaves diferentes de propósito: a primeira sai no
  código público do CentralSync, a segunda não pode sair de lugar nenhum.

Sem `MONTAFACIL_TO_CENTRALSYNC_KEY` configurada, a montagem é concluída
normalmente aqui, mas o botão de enviar falha (fica registrado um alerta no
log do servidor) e a montagem continua na fila do painel.

## Mapa da rota dentro da tela (opcional)

A tela **Rota** do painel do admin funciona sem nenhuma configuração: ela
monta os links de rota e abre no Google Maps do celular ou do navegador
(quando há mais de 10 paradas, a rota é dividida em trechos, porque esse é o
limite de uma rota por link do Google).

Se você quiser ver o mapa com a rota desenhada **dentro** da própria tela,
cadastre a variável `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` nas "Environment
Variables" com uma chave da [Maps Embed
API](https://developers.google.com/maps/documentation/embed/get-api-key). O
mapa embutido só aparece quando a chave existe **e** o ponto de partida está
preenchido.

## Estrutura do projeto (para referência técnica)

- `prisma/schema.prisma` — modelo do banco de dados (usuários, lojas,
  comissões, montagens).
- `lib/auth.ts` — login, sessão e proteção de acesso por papel (admin/montador).
- `lib/actions/` — as ações do sistema (criar montador, criar montagem,
  marcar pagamento, enviar a conclusão ao CentralSync, etc).
- `lib/financeiro.ts` — o percentual que a empresa cobra da loja e as contas
  que dependem dele (usado no painel e no financeiro).
- `lib/datas.ts` — mês, dia e formatação ancorados no fuso de Itabuna, sem
  depender do fuso em que o servidor está rodando.
- `lib/validacao.ts` — o que é aceito nos campos que chegam de fora (status,
  tipo de ocorrência etc).
- `lib/nota-fiscal.ts` — leitura do XML da NFe e do texto do DANFE lido por
  OCR (código puro, coberto por testes).
- `lib/limite.ts` — limite de tentativas de login e de chamadas à API.
- `lib/mapas.ts` — links de Google Maps/Waze de uma parada e a montagem da
  rota com várias paradas.
- `app/admin/` — todas as telas do painel do administrador (inclusive
  `app/admin/rota`, a rota do dia).
- `app/montador/` — todas as telas do painel do montador.
- `components/` — componentes visuais reutilizados nas telas.
