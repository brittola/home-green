# Home Verdes — escala de home office do time

Data: 2026-11-09

## Intenção

Um time de 10 pessoas já faz home office alguns dias, mas sem organização: tem dia em que todo mundo vai ao escritório e dia em que quase ninguém vai. O objetivo é **distribuir a presença** ao longo da semana. Não é sobre garantir colaboração ou que pessoas específicas se encontrem, é só sobre equilibrar quantas pessoas estão em casa por dia.

A aplicação é uma escala semanal compartilhada. Cada pessoa marca os próprios dias de home, enxerga quem mais marcou e esbarra em limites e regras que impedem o esvaziamento (principalmente o de emendar fim de semana). Toda sexta às 16h um lembrete no Slack chama o time para preencher a semana seguinte.

Sucesso: o time preenche a escala toda semana sem fricção, e nenhum dia fica vazio ou lotado no escritório por acaso.

## Objetivos

- Tela única de escala semanal, com atualização ao vivo, onde a pessoa escolhe seu nome, marca e desmarca dias e confirma.
- Validação das regras no servidor (a tela também mostra os bloqueios e os motivos).
- Visualização de quem tem cartão de estacionamento e de quais cartões estão livres em cada dia.
- Rota HTTP para o cron-job.org disparar o lembrete semanal no Slack.
- Limites por dia e cadastro de pessoas editáveis direto no banco (painel do Neon), com efeito imediato, sem deploy.

## Fora do escopo

- Login ou autenticação de usuários. A pessoa escolhe o próprio nome numa lista. Foi uma decisão consciente: o time confia entre si, e qualquer um tecnicamente pode marcar por outro.
- Tela de administração. Pessoas e limites são editados no painel do Neon.
- Registrar empréstimos de cartão de estacionamento. O cartão só aparece na tela, e o time combina o empréstimo fora da aplicação.
- Negociação ou troca de dias dentro da aplicação. Quem marca primeiro leva, e o time negocia entre si.
- Feriados, férias e ausências.
- Agendamento interno. O disparo semanal é feito pelo cron-job.org.

## Anti-objetivos (seria um fracasso mesmo funcionando)

- Duas pessoas conseguirem ocupar a última vaga de um dia ao mesmo tempo.
- O lembrete chegar duplicado no canal.
- A rota do cron poder ser disparada por qualquer pessoa que descubra a URL.
- Perder os dados por causa da infraestrutura gratuita (por exemplo, o Postgres gratuito do Render, que expira).

## Fluxo principal

1. Na sexta às 16h (horário de São Paulo), o cron-job.org chama a rota do lembrete. A aplicação posta no canal do Slack uma mensagem com `<!here>` e o link da escala.
2. A pessoa abre o link e cai na **semana seguinte**.
3. Ela escolhe o próprio nome numa lista. O navegador lembra a escolha nas próximas visitas, e ela pode trocar.
4. Ela vê os cinco dias úteis (segunda a sexta). Cada dia mostra:
   - quantas vagas de home estão ocupadas, no formato "2 / 3 em home";
   - os nomes de quem está em home, com 🅿️ ao lado de quem tem cartão de estacionamento;
   - o quadro de cartões livres: quantos e de quem são (os donos de cartão que estão em home naquele dia), ou "nenhum cartão livre";
   - o estado do dia: livre, selecionado, lotado, bloqueado por regra (com o motivo por escrito) ou passado.
5. Ela marca e desmarca dias e clica em **Confirmar**. O servidor valida as regras. Se alguma falhar, por exemplo porque alguém pegou a vaga enquanto ela decidia, a tela explica o que aconteceu e mostra o estado atual.
6. As mudanças das outras pessoas aparecem ao vivo enquanto a tela está aberta.

## Janela de semanas

- A semana vai de segunda a sexta. Sábado e domingo não aparecem.
- Só dá para **editar** a semana atual e a seguinte.
- Só dá para **visualizar** até 3 semanas antes da atual, sem editar.
- Não dá para ver nada além da semana seguinte.
- O dia de hoje e os dias que já passaram ficam travados: não dá para marcar nem desmarcar. Os dias seguintes da semana atual podem ser marcados e desmarcados.
- Todas as datas são calculadas no fuso `America/Sao_Paulo`.
- No sábado e no domingo, a "semana atual" continua sendo a que acabou de terminar (semana ISO, de segunda a domingo). Assim, no fim de semana só a semana seguinte tem dias editáveis. O link do lembrete leva o `weekStart` explícito, então sempre abre a semana certa. *(Decisão minha.)*

## Regras

Limites de vagas (ficam no banco e podem ser editados):

| Dia | Máximo de pessoas em home |
|---|---|
| Segunda | 3 |
| Terça | 5 |
| Quarta | 5 |
| Quinta | 5 |
| Sexta | 3 |

Limite por pessoa (fica no código, como uma constante no módulo de regras; *decisão minha deixar no código e não no banco*):

- **No máximo 2 dias de home por semana por pessoa.** Quem já tem 2 dias marcados na semana vê os outros dias livres bloqueados com o motivo "Você já tem 2 dias de home nesta semana". Não existe mínimo: a pessoa pode não marcar nenhum dia.

Regras de segunda e sexta (ficam no código, por pessoa):

1. **No máximo uma segunda de home por mês**, considerando o mês da data. Uma segunda no começo de dezembro conta para dezembro, mesmo que a semana tenha começado em novembro.
2. **No máximo uma sexta de home por mês**, com o mesmo critério de mês.
3. **Segunda e sexta na mesma semana não podem.**
4. **Sexta seguida da segunda não pode.** A pessoa não pode ter a sexta D e a segunda D+3. Essa regra vale mesmo na virada do mês. *(Decisão minha: a pessoa só pediu "em sequência", e eu estendi para a virada do mês.)*

Ao confirmar, só os **dias adicionados** são validados. Desmarcar um dia é sempre permitido, desde que seja de amanhã em diante. Dias já salvos que passem a violar uma regra, por exemplo porque um limite foi reduzido no Neon, continuam valendo e não impedem a pessoa de salvar outras mudanças. Na tela, um dia acima do limite aparece como "4 / 3 em home". *(Decisão minha.)*

As regras levam em conta todas as marcações já salvas da pessoa, inclusive de semanas passadas e de semanas fora da tela. Por exemplo, a sexta usada no começo do mês continua bloqueando as outras sextas daquele mês.

Mais regras vão surgir com o uso. As regras precisam ficar num único módulo, fácil de alterar, que a tela e o servidor usem para explicar por que um dia está bloqueado. *(Decisão minha sobre a organização do código.)*

Quando um dia está bloqueado por regra, a tela mostra o motivo em texto. Exemplos:
- "Você já usou sua segunda de novembro (09/nov)"
- "Você já tem a sexta 20/nov, então não pode marcar a segunda seguinte"
- "Lotado"

## Cartão de estacionamento

- É uma marcação no cadastro da pessoa (`tem_cartao`). Quem tem o cartão vai ao escritório de graça.
- Serve só para visualização: em cada dia, a tela lista os donos de cartão que estão em home, que é quando o cartão fica livre para outra pessoa pegar emprestado.
- Todo mundo vê a mesma tela, tenha cartão ou não.

## Lembrete no Slack

- Rota: `POST /api/cron/weekly-reminder`.
- A rota exige o cabeçalho `Authorization: Bearer <CRON_SECRET>`. Sem ele ou com valor errado, responde 401 e não envia nada.
- A mensagem é postada com `chat.postMessage`, da biblioteca `@slack/web-api`, usando o mesmo token de usuário (`xoxp-`, permissão `chat:write`) do projeto `~/linear-code-review`. A mensagem aparece como enviada pelo dono do token, que precisa estar no canal.
- Texto sugerido *(decisão minha)*: `<!here> Hora de preencher a escala de home office da semana de 16 a 20/nov 👉 <URL|abrir escala>`. O link abre direto a semana seguinte.
- **Uma mensagem por semana:** a tabela `reminders_sent` guarda a segunda-feira da semana a que o lembrete se refere. Se já existe registro para aquela semana, a rota responde 200 sem postar de novo. *(Decisão minha.)*
- A rota calcula a "semana seguinte" pela data do momento em que é chamada. Não precisa validar se é sexta, porque quem decide o horário é o cron-job.org.
- Render gratuito: o serviço dorme depois de 15 minutos sem acesso e pode levar de 30 a 60 segundos para acordar. *(Decisão minha:)* recomendar no README um segundo job no cron-job.org que chama `GET /healthz` às 15h55 de sexta, para o serviço estar acordado às 16h. A regra de uma mensagem por semana cobre eventuais novas tentativas do cron.

## Dados (Postgres no Neon)

O Neon foi escolhido pelo usuário porque o Postgres gratuito do Render expira em 30 dias.

- `people`: `id`, `name` (único), `has_parking_card` (boolean, padrão false), `active` (boolean, padrão true), `created_at`. Pessoas inativas não aparecem na lista de nomes, mas as marcações antigas delas continuam aparecendo nas semanas passadas.
- `day_limits`: `weekday` (1 = segunda … 5 = sexta, chave primária) e `max_remote` (inteiro). Uma migração cria os valores iniciais: 3, 5, 5, 5, 3.
- `remote_days`: `id`, `person_id`, `date`, `created_at`, com unicidade em (`person_id`, `date`).
- `reminders_sent`: `week_start` (date, chave primária), `sent_at`.

As pessoas são cadastradas pelo usuário no painel do Neon. O README traz o SQL de exemplo para inserir as 10 pessoas.

Os limites e as pessoas são lidos do banco a cada requisição, sem cache, para que uma edição no painel tenha efeito imediato.

## Concorrência

Confirmar a escala de uma semana tem de ser atômico e seguro contra corrida: duas pessoas pegando a última vaga ao mesmo tempo, ou a mesma pessoa confirmando em duas abas. O servidor valida e grava numa única transação, com algum mecanismo de lock: um advisory lock por data, `SELECT … FOR UPDATE` ou isolamento serializable com nova tentativa. A escolha do mecanismo fica com quem constrói. Se a validação falhar, nada da confirmação é gravado.

## API (formato sugerido; os detalhes ficam com quem constrói)

- `GET /api/people`: pessoas ativas (`id`, `name`, `hasParkingCard`).
- `GET /api/weeks/:weekStart`: os 5 dias da semana com o limite, as pessoas em home e os cartões livres, mais se a semana pode ser editada. Com `?personId=`, inclui para cada dia o estado e o motivo de bloqueio daquela pessoa.
- `PUT /api/weeks/:weekStart/people/:personId`: recebe `{ dates: [...] }`, o conjunto de dias de home da pessoa naquela semana. Só os dias de amanhã em diante são alterados; o dia de hoje e os anteriores ficam como estavam. Se alguma regra falhar, responde 409 com os motivos.
- `GET /api/events`: Server-Sent Events. O servidor emite `week-changed` com o `weekStart` sempre que alguém confirma, e a tela recarrega a semana. Se a conexão cair, a tela passa a consultar a semana a cada ~10 segundos. *(Decisão minha: SSE é mais simples que WebSocket e funciona no Render gratuito.)*
- `POST /api/cron/weekly-reminder`: veja a seção do Slack.
- `GET /healthz`: responde 200 e faz uma consulta simples ao banco.

## Tela

- Funciona bem no celular, porque muita gente vai abrir pelo Slack no telefone *(palpite meu)*.
- A navegação entre semanas usa as setas ← → e fica dentro da janela permitida. Há um indicador de "editável" ou "somente visualização".
- O primeiro rascunho, já validado com o usuário, está em `.superpowers/brainstorm/*/content/escala-semana-v2.html`: grade de 5 dias, contador, nomes, 🅿️, quadro de cartões livres, motivo de bloqueio e botão Confirmar.
- **Antes de fechar o visual final, o usuário pediu para rodar a skill `/impeccable:impeccable` para chegar na melhor visualização possível.** Isso faz parte do plano.
- A interface é em português do Brasil.

## Tecnologias (decisões minhas, aprovadas pelo usuário)

- Node 22 com TypeScript, como em `~/linear-code-review`.
- Um único serviço web no Render (plano gratuito) servindo a API e a tela já compilada.
- Banco: Postgres no Neon (plano gratuito).
- Framework HTTP, biblioteca de banco e migrações, e framework da tela ficam com quem constrói. Sugestão: Fastify, Drizzle (com drizzle-kit para as migrações), React com Vite e zod.
- Variáveis de ambiente: `DATABASE_URL`, `SLACK_USER_TOKEN`, `SLACK_CHANNEL_ID`, `CRON_SECRET`, `APP_URL`.

## Restrições do usuário

- Mensagens de commit, nomes de branch e PRs em inglês, no formato Conventional Commits, sem rodapé de coautoria nem linha de "Generated with".
- Nenhum comentário no código.
- Testes podem ser escritos, mas **nunca executados** pelo agente.
- O diretório ainda não é um repositório git.

## O que fica com quem constrói

- Escolha das bibliotecas, dentro das sugestões acima.
- Estrutura de pastas.
- Formato exato da API.
- Mecanismo de lock.
- Visual final (via `/impeccable`), respeitando o conteúdo do rascunho.
- Como o README explica a configuração do Neon, do Render, do cron-job.org e do Slack.
