# Home Verdes

Escala semanal de home office do time. Cada pessoa escolhe seu nome, marca até 2 dias de home por semana e confirma. A tela mostra quem está em home em cada dia, quantas vagas restam e quais cartões de estacionamento estão livres. Toda sexta às 16h um lembrete é postado no Slack.

- **API**: Node 22 + Fastify, no Render (plano gratuito).
- **Tela**: React + Vite, na Vercel.
- **Banco**: Postgres no Neon (plano gratuito).

Design e regras: [`docs/superpowers/specs/2026-11-09-home-verdes-design.md`](docs/superpowers/specs/2026-11-09-home-verdes-design.md).

## Regras

| Regra | Onde muda |
|---|---|
| Limite de pessoas em home por dia (seg 3, ter-qui 5, sex 3) | Banco, tabela `day_limits` |
| Máximo de 2 dias de home por semana por pessoa | Código, `shared/rules.ts` |
| Uma segunda e uma sexta por mês | Código, `shared/rules.ts` |
| Segunda e sexta na mesma semana não podem | Código, `shared/rules.ts` |
| Sexta seguida da segunda não pode (inclusive na virada do mês) | Código, `shared/rules.ts` |
| Dois dias de home seguidos não podem (ex.: terça e quarta) | Código, `shared/rules.ts` |
| Só a semana atual e a próxima podem ser editadas; hoje e dias passados ficam travados | Código, `shared/window.ts` |

## Rodar localmente

Requer Node 22 e um Postgres.

```bash
npm install
cp .env.example .env
npm run dev:server
npm run dev:web
```

- `dev:server` sobe a API em `http://localhost:3000` e aplica as migrações.
- `dev:web` sobe a tela em `http://localhost:5173`, com proxy de `/api` para a API.

Postgres rápido com Docker:

```bash
docker run -d --name hv-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 5433:5432 postgres:16
```

## Variáveis de ambiente

API (Render):

| Variável | O que é |
|---|---|
| `DATABASE_URL` | Connection string do Neon, na versão **pooled** |
| `SLACK_USER_TOKEN` | Token de usuário `xoxp-` com escopo `chat:write` |
| `SLACK_CHANNEL_ID` | ID do canal do lembrete, por exemplo `C0123ABCD` |
| `CRON_SECRET` | Segredo da rota do cron, com no mínimo 16 caracteres |
| `APP_URL` | URL da tela na Vercel, sem barra no final. É o link enviado no Slack |
| `WEB_ORIGIN` | Origem liberada no CORS, normalmente igual ao `APP_URL` |
| `PORT` | Opcional, o padrão é `3000`. O Render define essa variável sozinho |

Tela (Vercel):

| Variável | O que é |
|---|---|
| `VITE_API_URL` | URL da API no Render, sem barra no final, por exemplo `https://home-verdes-api.onrender.com` |

## Deploy

### 1. Neon

1. Crie um projeto no Neon.
2. Copie a connection string **pooled** e use como `DATABASE_URL`.
3. As tabelas e os limites iniciais são criados sozinhos quando a API sobe.

### 2. Render (API)

1. Crie um Blueprint apontando para este repositório. O `render.yaml` já define o serviço.
2. Preencha as variáveis de ambiente. Gere o `CRON_SECRET` com `openssl rand -hex 24`.
3. Confira se `https://<servico>.onrender.com/healthz` responde `{"ok":true}`.

### 3. Vercel (tela)

1. Importe o repositório com o Root Directory na raiz. O `vercel.json` já define o build e o diretório `dist/web`.
2. Defina `VITE_API_URL` com a URL do Render e faça o deploy.
3. Volte ao Render e garanta que `APP_URL` e `WEB_ORIGIN` estão com a URL final da Vercel.

### 4. Slack

Reaproveite o `SLACK_USER_TOKEN` do linear-code-review, que é um token de usuário com escopo `chat:write`.

- A mensagem aparece como enviada pelo dono do token, que precisa ser membro do canal.
- Para achar o `SLACK_CHANNEL_ID`: abra o canal, clique no nome dele e veja o ID no fim da aba "Sobre".

### 5. cron-job.org

Crie dois jobs, os dois no fuso `America/Sao_Paulo`, às sextas:

| Horário | Método e URL | Para quê |
|---|---|---|
| 15:55 | `GET https://<servico>.onrender.com/healthz` | Acorda o serviço, que dorme depois de 15 min sem acesso |
| 16:00 | `POST https://<servico>.onrender.com/api/cron/weekly-reminder` | Posta o lembrete |

No job das 16h:

- Adicione o header `Authorization: Bearer <CRON_SECRET>`.
- Use o maior timeout que o plano permitir.

A rota envia no máximo um lembrete por semana, então uma nova tentativa não duplica a mensagem.

## Cadastro de pessoas e limites

Tudo é feito pelo SQL Editor do Neon e vale na hora, sem deploy.

```sql
INSERT INTO people (name, has_parking_card) VALUES
  ('Ana', true),
  ('Bruno', false);

UPDATE people SET has_parking_card = true WHERE name = 'Bruno';

UPDATE people SET active = false WHERE name = 'Ana';

UPDATE day_limits SET max_remote = 4 WHERE weekday = 3;
```

- `weekday`: 1 = segunda … 5 = sexta.
- Pessoas inativas somem da lista de nomes, mas continuam aparecendo nas semanas passadas.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev:server` | API em modo watch (lê `.env`) |
| `npm run dev:web` | Tela com Vite |
| `npm run build` | Compila a API (`dist/server`) e a tela (`dist/web`) |
| `npm start` | Sobe a API compilada |
| `npm run typecheck` | Checa os tipos de todo o projeto |
| `npm test` | Roda os testes (Vitest) |
| `npm run db:generate` | Gera uma nova migração a partir de `server/db/schema.ts` |
