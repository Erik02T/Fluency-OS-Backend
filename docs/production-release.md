# Manifesto da preparação local do Fluency OS

Ensaio de 25/11/2026. O candidato usa Vercel para Next.js, Render para NestJS, Neon para PostgreSQL e Upstash Free para Redis TCP com TLS. O [guia de produção](production.md) contém os campos de painel, as variáveis, a ordem da publicação e o procedimento de recuperação.

## Origem dos checkouts

| Repositório GitHub | HEAD no checkout | Base em `origin/main` | Commit de configuração recuperado |
| --- | --- | --- | --- |
| `Erik02T/Fluency-OS-Backend` | `85180ec122557f1c7794e7fb0f7590e8434b4a34` | `c8b464f5b30995260e2bdf6cf3f74822dbab76a6` | `5bfaebee4be9deaa6a155607351eeaf9a25d7c17` |
| `Erik02T/Fluency-OS-Frontend` | `5474f8af3536f479fe6fc6d3e16435148ca3b433` | `0bf5e9dd9656efc3490cc64e7ecf8775215c8bda` | `ea88475453b6447b0c0f5e1e3f3a09f2ec50dfb9` |

Os dois checkouts estavam em `homologacao/2026-11-24`, com a mesma árvore rastreada da base de cada repositório. Os commits de configuração estavam nos clones isolados de `fix/configuracao-producao`. Os patches correspondentes foram aplicados aos checkouts e receberam os ajustes deste candidato. Os arquivos de dados, seeds locais e evidências que já estavam modificados ou sem rastreamento no backend foram preservados. O ensaio usou cópias isoladas com conteúdo versionado e as alterações de configuração desta entrega. Os SHAs finais da release dependem da revisão e do commit das alterações.

## Runtime e artefatos

| Item | Versão ou referência |
| --- | --- |
| Node e npm | Node `22.23.5` e npm `10.9.9` nos dois builds. |
| API | NestJS `11.1.24`, Prisma CLI e Client `6.19.3`, ioredis `5.11.0` e better-sqlite3 `13.0.3`. |
| Frontend | Next.js `16.4.6`, build local `qul-7MG1UPTDuyw09yKFv`, TypeScript validado. |
| Serviços locais | PostgreSQL `16.14` e Redis `7.4.9`. |
| Migrações | 17 diretórios em [prisma/migrations](../prisma/migrations), terminando em `20261123093000_grammar_pipeline_history`. |
| Gramática | Seed N5 versionado, 40 pontos e 40 exemplos. |
| Vocabulário | JMdict inglês `3.6.2+20261116213322`. Arquivo compactado e JSON conferidos pelo [manifesto de integridade](../prisma/seed/vocabulary/jmdict-release.json). A carga produziu 8.000 vocábulos e 56.993 significados. |
| Kanji | `kanjidic2-json@0.1.0`, 13.108 registros e 24.348 significados. |

Os lockfiles mantêm as versões. Os workflows de CI verificam os projetos com `.node-version`. O frontend configura o deploy Git como manual e o backend usa o comando Start separado das migrações e cargas.

## Verificações executadas

| Controle | Resultado local |
| --- | --- |
| Backend em Linux | `npm ci --include=dev`, `npx --no-install prisma generate`, `npm run lint`, `npm run format:check`, `npx --no-install tsc --noEmit` e `npm run build` aprovados. A instalação nativa no Windows falhou porque faltava o compilador C++ requerido pelo better-sqlite3. A repetição em contêiner Linux passou com o lockfile. |
| Suítes backend | `npm test -- --runInBand` com 303 testes, `npm run grammar:test` com 42 e `npm run test:e2e -- --runInBand` com 113. |
| Frontend | `npm ci`, `npm run lint`, `npm test` (43 testes) e `npm run build` em Node 22. O lint registrou seis avisos preexistentes. O build precisou de rede para as fontes e avisou sobre a convenção `middleware.ts` do Next. |
| Configuração e CI | Workflows validados com `actionlint`. A configuração do Next recusou upstream ausente, HTTP externo, base pública absoluta e segredo curto. O segredo sintético esteve ausente em `.next/static`. |
| Migrações | `prisma migrate deploy` aplicou 17 em banco vazio. `prisma migrate status` passou, a repetição não teve pendências e `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` não detectou divergência. A suíte E2E usou outra base. |
| TLS, prontidão e retomada | API e Next de produção atrás de HTTPS local. PostgreSQL e Redis recusaram CA não confiável e hostname incorreto. Ao suspender cada serviço separadamente, `/api/health/ready` passou de 200 para 503 e voltou a 200 após a reconexão, com a API em execução. A porta do provedor simulada funcionou, e `APP_PORT` teve precedência em teste separado. |
| Sessão e cache | Edge via HTTPS confirmou login, renovação, abertura direta de Admin e logout. Visitante foi redirecionado, Professor recebeu 403 da API, Admin teve acesso e o pipeline validou 40 pontos. Cookies com `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` e escopo do host. Swagger 404. A API enviou `Cache-Control: private, no-store`. |
| Windows e Edge | Caso 42 por teclado passou em Kanji, Vocabulário e Gramática. A evidência de Firefox ESR com Orca veio da rodada anterior dos mesmos catálogos. Repita leitor de tela no deployment de homologação. |
| Cota e SRS | Com `CI=true`, a cota de login chegou ao limite de 100 e retornou 429 com `Retry-After`. Na conexão direta sem `TRUST_PROXY`, diferentes cabeçalhos encaminhados usaram a mesma cota real. Na interface, duas inclusões do mesmo Kanji geraram um item e `totalReviews` passou de 0 para 1 após a resposta. |
| Carga e recuperação | Os três seeds passaram e mantiveram as contagens na repetição. A gramática retornou zero pontos públicos após a carga e 40 após a publicação explícita na API do banco descartável. `pg_dump -Fc` e `pg_restore --single-transaction --exit-on-error` produziram uma cópia isolada com as mesmas contagens das 17 migrações, seis tabelas de conteúdo verificadas e resposta de revisão. |

Na amostra local de seis chamadas HTTPS com health, login, renovação, catálogo, fila e logout, o Redis registrou 5 `EVAL`, 1 `SETEX`, 2 `KEYS`, 2 `GET`, 1 `DEL` e 1 `PING`. Os scripts Lua executaram internamente 5 `INCR`, 5 `TTL` e 3 `EXPIRE`. O valor é atividade observada no servidor local. A cota faturável depende da medição no Upstash.

## Pendências dos provedores

| Responsável | Dados ou validação a registrar |
| --- | --- |
| Release | Aprovar o par de SHAs, branches finais e a abertura. Registrar o deployment anterior compatível para recuperação. |
| Vercel | Projeto, domínio, branch, backend de homologação associado ao Preview, Node efetivo, `API_UPSTREAM_URL`, `NEXT_PUBLIC_API_URL` e segredo do cookie por ambiente. Confirmar o build e as rotas no domínio final. |
| Render | Serviço, URL HTTPS, região, tipo de plano, segredo de cookie, segredos JWT, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL` e topologia para `TRUST_PROXY`. Confirmar readiness, timeout, identificação do IP e cabeçalhos em acessos via Vercel e direto. Escolher um executor de migração. |
| Neon | Projeto, região, banco, branch, usuário, estado inicial, URLs pooled e direta, janela de restauração, limites do pool e retomada a frio. Em base existente, repetir em cópia representativa com backup e verificação de duplicatas SRS. |
| Upstash | Endpoint TCP TLS isolado, região, limites efetivos, política de descarte e medição de comandos, TTL, sessão, cota e reconexão. A compatibilidade usando o serviço real depende desse recurso. |
| Produto e Conteúdo | Aprovar artefatos, atribuição, carga e publicação. Aprovar separadamente eventual atualização de Kanji em base existente. Definir a primeira conta Admin, contas de validação e monitoramento antes da abertura. |

A evidência local cobre a preparação dos repositórios. Os testes finais na topologia dos provedores, a compatibilidade real do Upstash e a decisão de abertura aguardam os recursos e autorizações da etapa de execução.
