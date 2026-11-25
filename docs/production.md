# Configuração de produção do Fluency OS

O navegador chama `/api` no domínio da Vercel. O Next preserva a precedência das próprias rotas e remove o prefixo no encaminhamento. Por exemplo, `/api/auth/login` chega ao Render como `/auth/login`. O Render se conecta ao Neon e ao Upstash por TLS. Use recursos e segredos separados para desenvolvimento, ensaio, homologação e produção. O [manifesto da preparação](production-release.md) registra os checkouts e as verificações.

## Vercel

| Campo | Configuração |
| --- | --- |
| Framework e raiz | Next.js, raiz do repositório frontend. |
| Node e comandos | 22.x no projeto. Instalação `npm ci`, build `node --version && npm run build`, saída padrão do Next. |
| Branch e publicação | Defina a branch aprovada. `vercel.json` desativa o deploy automático via Git. Antes de conectar o repositório, confira se o assistente inicia um primeiro deployment. |
| `NEXT_PUBLIC_API_URL` | `/api`. É a única variável pública dessas três e tem `/api` como padrão no build. |
| `API_UPSTREAM_URL` | Origem HTTPS pública do Render, sem caminho, credenciais, consulta ou fragmento. Forneça no build. O ensaio local pode usar um upstream HTTP no loopback atrás do HTTPS local. |
| `AUTH_ROLE_COOKIE_SECRET` | Segredo de servidor com pelo menos 32 bytes e igual ao da API do mesmo ambiente. O build valida a presença, e o middleware verifica o HMAC em runtime. |

Configure Production e Preview separadamente. Vincule Preview apenas ao backend de homologação. Mudanças de variáveis exigem novo deployment. Confirme que login e refresh mantêm cookies host-only, `Secure`, `HttpOnly`, `SameSite=Lax` e `Path=/`. Eles devem chegar ao navegador no domínio da Vercel. A API usa `Cache-Control: private, no-store`. [Variáveis na Vercel](https://vercel.com/docs/environment-variables) · [Configuração Git](https://vercel.com/docs/project-configuration/git-configuration)

## Render

| Campo | Configuração |
| --- | --- |
| Serviço | Node Web Service, raiz do repositório backend, branch aprovada e Auto-Deploy **Off**. Escolha região próxima do Neon e do Upstash. |
| Node | A raiz contém `.node-version` com `22`. Verifique a versão efetiva no log do build. |
| Build | `node --version && npm ci --include=dev && npx --no-install prisma generate && npm run build`. O build preserva a instalação fixada pelo lockfile e não aplica migrações nem seeds. `better-sqlite3` pode depender de Python, make e compilador C++. O Prisma requer OpenSSL. |
| Start e health check | `npm run start:prod`. Use `/health/ready` para testar PostgreSQL e Redis. `/health/live` verifica o processo. O Render espera a resposta HTTP em até cinco segundos. |
| `NODE_ENV` | `production`. |
| `DATABASE_URL` | URL **pooled** do Neon para o processo da API, com `sslmode=require&sslaccept=strict`. |
| `REDIS_URL` | Endpoint TCP autenticado do Upstash na forma `rediss://USER:PASSWORD@HOST:PORT`. Use a porta do painel e codifique os caracteres reservados das credenciais na URI. |
| `JWT_SECRET`, `JWT_EXPIRATION` | Segredo próprio do ambiente e expiração opcional, padrão `15m`. |
| `JWT_REFRESH_SECRET` | Variável obrigatória no validador existente. A sessão atual usa UUID opaco no Redis com TTL de sete dias. `JWT_REFRESH_EXPIRATION` não regula esse TTL. |
| `AUTH_ROLE_COOKIE_SECRET` | Igual ao da Vercel e distinto dos segredos JWT. |
| `FRONTEND_URL` | Origem HTTPS exata da Vercel, sem barra final. Use apenas origens explicitamente autorizadas. |
| `TRUST_PROXY` | Configure somente IPs ou CIDRs confirmados para os proxies que controlam os cabeçalhos de encaminhamento. Sem valor, a API usa o endereço da conexão. A configuração é pendente até o ensaio na topologia real. |
| `PORT`, `APP_PORT` | Render fornece `PORT`. Deixe `APP_PORT` ausente, pois ela tem precedência. A API escuta em `0.0.0.0`. |
| `SWAGGER_ENABLED`, `RATE_LIMIT_MAX_REQUESTS` | Swagger desativado por padrão em produção. Limite padrão de 600 por minuto por IP e área, com limite próprio de 100 para autenticação. |
| CA privada | Para PostgreSQL use `sslcert` apontando para a CA no filesystem. Para Redis use `NODE_EXTRA_CA_CERTS` com o caminho do PEM antes de iniciar Node. Use os secret files do ambiente quando necessário. |

O [validador de produção](../src/config/validation.schema.ts) exige as configurações da API. A [inicialização HTTP](../src/main.ts) usa `APP_PORT` ou `PORT` e aplica CORS, os endereços de proxies confiáveis e a política do Swagger.

Use uma instância paga para disponibilidade contínua. Se escolher Free para piloto, valide o retorno depois da suspensão por inatividade. Observe readiness, duração da conexão a frio e cota tanto pelo domínio Vercel quanto pelo endereço direto do Render. Confira o IP resolvido e o protocolo observado, incluindo a rejeição de cabeçalhos de encaminhamento não confiáveis. Os acessos via Vercel podem compartilhar a cota do proxy até a atribuição correta por IP ser comprovada. [Deploy no Render](https://render.com/docs/deploys) · [Health checks](https://render.com/docs/health-checks) · [Limitações do Free](https://render.com/docs/free) · [Express atrás de proxies](https://expressjs.com/en/guide/behind-proxies/)

## Neon e migrações

1. Registre projeto, branch do banco, nome, usuário, região, plano, limite de conexões, armazenamento, suspensão e janela de restauração. Verifique se o banco contém dados. Confirme `sslmode=require&sslaccept=strict` tanto na URL pooled quanto na direta. Preserve parâmetros compatíveis do Neon, como `channel_binding` quando aplicável. Teste a primeira conexão e a retomada na versão do Prisma fixada no lockfile. [Neon com Prisma](https://neon.com/docs/guides/prisma) · [Conector PostgreSQL do Prisma v6](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql)
2. Use a URL **direta** em `DATABASE_URL` no executor de migração. O schema já lê essa variável. Para Web Service pago, injete no ambiente do comando a URL direta guardada em um secret file. Por exemplo, Pre-Deploy Command `DATABASE_URL="$(cat /etc/secrets/neon-direct-url)" npx --no-install prisma migrate deploy`. Sem pre-deploy, o operador roda o mesmo comando de migração por um executor administrativo isolado, com a URL direta no seu gerenciador de segredos. Escolha um executor por versão e mantenha o ambiente da API com a URL pooled.
3. Para banco vazio, execute `npx --no-install prisma migrate deploy` e `npx --no-install prisma migrate status`. O candidato contém 17 migrações. Confirme o schema e uma segunda execução sem migrações pendentes. Em atualização, compare `_prisma_migrations` com o histórico da release e teste em cópia representativa antes de reservar a janela sem escritas.
4. Antes de atualizar, faça backup com a política do plano e ensaie a restauração em outro banco. Exemplo com serviços locais de libpq previamente cadastrados em arquivo privado e TLS verificado.

```sh
pg_dump --dbname=service=fluency_source --format=custom --file=fluency.backup
pg_restore --dbname=service=fluency_restore_test --single-transaction --exit-on-error fluency.backup
```

Confirme schema, contagens e uma amostra de fluxos na cópia restaurada. Revise a migração `20261123090000_review_session_integrity`. Ela bloqueia as tabelas de sessões e respostas, rejeita respostas duplicadas, recalcula contadores e abandona sessões abertas. O preflight deve retornar zero grupos antes de aplicar em base existente.

```sql
SELECT "sessionId", "itemType", "itemId", COUNT(*)
FROM review_answers
GROUP BY "sessionId", "itemType", "itemId"
HAVING COUNT(*) > 1;
```

## Upstash Free

Use Redis TCP com TLS na região mais próxima disponível. Na consulta de 25/11/2026, o plano listava um banco gratuito, 250 MB, 500 mil comandos e 10 GB de transferência por mês. Confirme no painel, incluindo descarte de chaves e comportamento ao atingir os limites. Para testes no provedor, use recurso isolado. Redis local atende ao ensaio sem consumir a cota. [Preços](https://upstash.com/pricing/redis) · [Compatibilidade TCP](https://upstash.com/docs/redis/overall/compatibility)

| Consumidor | Operações e efeito |
| --- | --- |
| Sessão e renovação | `SETEX` no login e registro, `KEYS` + `GET` na renovação e `DEL` adicional no logout de sessão válida. TTL de sete dias. `EXISTS` e invalidação por padrão de chaves estão no serviço, sem chamadas no fluxo atual. Meça o custo de `KEYS` com volume representativo. |
| Cota HTTP | Um `EVAL` por chamada contabilizada. O script usa `INCR`, `TTL` e `EXPIRE` na mesma chave, com janela de 60 s. O health e requisições OPTIONS escapam da cota. Sem Redis, a API continua aceitando requisições e a cota deixa de operar. |
| Prontidão e conexão | `PING` em cada readiness além da conexão e do `INFO` do ioredis. Os comandos operacionais listados na página de preços, incluindo `PING` e `INFO`, não contam. |
| Outros | Os métodos genéricos de cache `GET`, `SET`, `SETEX` e `DEL` não têm consumidores ativos. Não há worker Redis ou polling de fila. A fila SRS e as respostas usam PostgreSQL. |

O [serviço Redis](../src/common/services/redis.service.ts) concentra conexão, TLS e comandos. Seus chamadores ativos são [autenticação](../src/modules/auth/auth.service.ts), [cota HTTP](../src/common/middleware/rate-limit.middleware.ts) e [prontidão](../src/app.service.ts). A [fila SRS](../src/modules/review/repositories/review.repository.ts) usa o Prisma.

Em falha do Redis, a prontidão responde 503. Login, registro com sessão, renovação e logout dependem do Redis. O registro pode já ter persistido o usuário no PostgreSQL se a criação da sessão falhar. O acesso autenticado pelo JWT já emitido pode continuar até o vencimento. A perda de chaves de sessão exige novo login.

Meça a diferença dos contadores do Upstash durante 15 minutos ociosos e durante uma amostra registrada de login, renovação, navegação, revisão e logout. Anote número de chamadas HTTP, comandos do painel, frequência de readiness, repetições e efeito de `EVAL`, além de latência de reconexão. Estime `comandos mensais ≈ 30 × (comandos automáticos diários + chamadas diárias × comandos medidos por chamada)`. Em ordem de grandeza, 500 mil em 30 dias equivalem a cerca de 16,7 mil comandos por dia. Confirme as operações reais, o TTL, a política de descarte e a margem antes da abertura.

## Carga dos catálogos e publicação editorial

O [manifesto 1.0.0](../seed/catalogs/v1/manifest.json) registra os catálogos do PostgreSQL local do Fluency OS, as fontes e os SHA-256. Os arquivos contêm conteúdo de Vocabulário e Gramática com seus IDs, exemplos e metadados editoriais. A exportação usa uma lista explícita de campos e uma transação somente leitura com visão consistente. Datas operacionais de criação e atualização ficam fora do snapshot.

### Exportar e validar

No checkout do backend com as dependências instaladas e o Prisma Client gerado, injete a URL do banco de origem pelo gerenciador de segredos na variável `CATALOG_SOURCE_DATABASE_URL`. Use um usuário com acesso de leitura aos dois catálogos. O diretório de saída deve ser novo. Para preparar outra versão, compare o conteúdo, confira as fontes e atualize os arquivos versionados após a revisão.

```sh
npm run db:catalogs:export -- 1.0.0 ./data/generated/catalogs-export-1.0.0
npm run db:catalogs:validate -- ./data/generated/catalogs-export-1.0.0
npm run db:catalogs:validate
```

O último comando valida o snapshot versionado. Ele verifica os hashes, a estrutura, a unicidade dos IDs e as contagens do manifesto. O seed repete essas verificações antes de conectar ao destino.

### Executar a carga no Render

Use o artefato do commit aprovado com `seed/catalogs/v1`, Node 22, as dependências do lockfile (incluindo `ts-node`) e o Prisma Client gerado. Confirme `prisma migrate status` no executor da release. Configure a URL **direta** do Neon, sem `-pooler` no hostname, no secret file `neon-direct-url`, com `sslmode=require&sslaccept=strict`. Execute o comando abaixo uma vez a partir da raiz em um executor administrativo, por exemplo um shell efêmero de serviço pago. A atribuição de `DATABASE_URL` vale só para o comando. [Shell efêmero do Render](https://render.com/docs/ssh) · [Secret files no Render](https://render.com/docs/configure-environment-variables) · [Neon com Prisma](https://neon.com/docs/guides/prisma)

```sh
test -s /etc/secrets/neon-direct-url && DATABASE_URL="$(cat /etc/secrets/neon-direct-url)" npm run db:seed:catalogs
```

O comando carrega Vocabulário e Gramática em lotes dentro de uma única transação. Durante a transação, as tabelas de conteúdo permitem consultas e bloqueiam outras escritas. Rode em uma janela administrativa sem edições no catálogo. A execução retorna código diferente de zero em caso de erro e reverte as gravações da tentativa. Mantenha a carga como comando administrativo. Para executar fora do Render, injete a mesma URL direta em `DATABASE_URL` por meio do gerenciador de segredos do executor e rode `npm run db:seed:catalogs`.

Os comandos `npm run db:seed:vocabulary` e `npm run db:seed:grammar` carregam os catálogos separadamente. Ambos aceitam `--release` como alias compatível. O importador preserva os registros já existentes, incluindo seus exemplos e decisões editoriais. Ele reconhece Vocabulário pelo ID ou pelo par palavra/leitura e Gramática pelo ID ou pelo par fonte/ID de origem. Compare divergências de conteúdo e contagem em bases já preenchidas. A importação adiciona registros novos com o conjunto completo de filhos da origem.

### Conferir as contagens

Em uma base inicial vazia, compare as contagens com o manifesto.

| Catálogo | Nível | Registros | Significados | Exemplos |
| --- | --- | ---: | ---: | ---: |
| Vocabulário | Sem JLPT | 8.000 | 56.958 | 0 |
| Gramática | N5 | 40 | — | 40 |
| Gramática | N4 | 50 | — | 245 |
| Gramática | N3 | 63 | — | 315 |
| Gramática | N2 | 63 | — | 305 |
| Gramática | N1 | 70 | — | 235 |
| Gramática | Total | 286 | — | 1.140 |

```sql
SELECT "jlptLevel", COUNT(*) FROM vocabulary GROUP BY 1;
SELECT COUNT(*) FROM vocabulary_meanings;
SELECT COUNT(*) FROM vocabulary_examples;
SELECT p."jlptLevel", p."reviewStatus", COUNT(DISTINCT p.id) AS points,
       COUNT(e.id) AS examples
FROM grammar_points p
LEFT JOIN grammar_examples e ON e."grammarPointId" = p.id
GROUP BY 1, 2
ORDER BY 1, 2;
```

A primeira carga em base vazia reporta `inserted` de 8.000 e 286. Uma segunda carga sobre o mesmo catálogo reporta `inserted` igual a zero e `preserved` de 8.000 e 286. O catálogo de Gramática começa com 286 pontos `VALIDATED` e zero `PUBLISHED`. Os estados originais constam do manifesto.

### Publicar apenas os pontos aprovados

O snapshot preserva explicações curtas da origem e exemplos como encontrados. Nos níveis N1 a N4, 1.100 exemplos trazem o próprio japonês no campo de tradução. Use a lista de revisão editorial para confirmar as traduções, leituras e correspondência dos exemplos com os padrões antes de aprovar cada ponto.

1. Com uma sessão de Admin, use `GET /admin/grammar-points?status=VALIDATED` para localizar pontos e `GET /admin/grammar-points/{id}` para inspecionar os detalhes. Use o ID do registro no **destino**.
2. Depois da revisão, envie `PATCH /admin/grammar-points/{id}/status` com o corpo `{"reviewStatus":"REVIEWED"}`. Para cada ponto aprovado para o público, envie o mesmo PATCH com `{"reviewStatus":"PUBLISHED"}`. A API exige uma sessão Admin. Em chamadas de automação, use o cabeçalho `Authorization: Bearer $ADMIN_ACCESS_TOKEN` e `Content-Type: application/json`.
3. Confira `GET /grammar/{id}` e `GET /grammar` como visitante. O detalhe deve abrir após a publicação e a listagem só deve contar os pontos `PUBLISHED`.

## Kanji e primeira conta administrativa

1. `npm run db:seed` carrega Kanji pelo `kanjidic2-json` fixado no lockfile. Controle esperado de 13.108 registros e 24.348 significados. O seed recria os significados. Qualquer atualização de uma base existente exige aceite separado e cópia restaurável.
2. Para a primeira conta Admin, cadastre o operador pela interface de homologação do destino aprovado, com senha própria. Com a identidade confirmada, o DBA localiza a conta por ID e promove exatamente uma conta ativa de `STUDENT` a `ADMIN` em transação controlada na tabela `users`. Confirme o ID e o papel antes de confirmar a transação. Encerre a sessão anterior, faça novo login e verifique a rota Admin. Os seeds de produção devem conter apenas dados de catálogo.

O pipeline offline de tradução, quando utilizado, precisa de Python e do modelo OPUS-MT com `GRAMMAR_TRANSLATION_PYTHON`, `GRAMMAR_LOCAL_TRANSLATION_MODEL_DIR` e `GRAMMAR_LOCAL_TRANSLATION_THREADS` conforme o ambiente. O build e o runtime de tráfego não dependem dessa tarefa. Use um executor administrativo quando o trabalho precisar de arquivos locais persistentes.

## Ordem da release e recuperação

1. Depois da autorização, fixe o par de commits, configure os serviços e segredos, confirme destinos e faça backup e restauração de ensaio quando houver dados existentes.
2. Aplique as migrações com o executor escolhido. Publique a API e confirme readiness, logs e Swagger. Faça então o build Vercel com as URLs do ambiente. Registre os IDs, o Node efetivo e o estado do schema.
3. Valide no domínio final cookies, ausência de cache compartilhado, visitante, Professor e Admin, além de cota, fila, retomada e foco no caso 42 em Kanji, Vocabulário e Gramática. Faça as cargas aprovadas e mantenha o aceite de publicação editorial separado da abertura ao público.
4. Se a migração falhar, preserve a cópia e o estado de `_prisma_migrations`. Reconcilie as duplicatas SRS e verifique se houve reversão antes de usar `prisma migrate resolve`. Se precisar recuar de uma aplicação já publicada, confira se o par anterior de deployments é compatível com o schema atual. Suspenda escritas conforme a janela de recuperação. Restaure em destino separado e reconcilie escritas posteriores ao backup antes de trocar conexões. [Recuperação de migrações do Prisma](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing)
