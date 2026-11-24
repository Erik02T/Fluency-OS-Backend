# Homologação das correções do Fluency OS

A rodada local de 23 de novembro de 2026 usou os commits de referência `da77efe` no backend e `021c040` no frontend, com as correções nos diretórios de trabalho. PostgreSQL 16 e Redis 7 rodaram em contêineres descartáveis. A matriz foi reconstruída a partir do Swagger, pois o relatório original de QA não acompanhava o plano.

## Migração de SRS

Antes de migrar, exporte uma cópia de leitura da base anterior e ensaie a restauração. Em uma janela que interrompa as escritas de revisão, use a consulta abaixo para identificar grupos que exigem reconciliação. Compare cada grupo com o histórico do mesmo card em outras sessões e com o progresso em `user_kanji_progress` ou `user_vocabulary_progress`.

```sql
SELECT s."userId", a."sessionId", a."itemType", a."itemId",
       s."totalItems", s."completedItems", s."correctItems",
       jsonb_agg(to_jsonb(a) ORDER BY a."answeredAt", a."id") AS answers
FROM "review_answers" a
JOIN "review_sessions" s ON s."id" = a."sessionId"
GROUP BY s."userId", a."sessionId", a."itemType", a."itemId",
         s."totalItems", s."completedItems", s."correctItems"
HAVING count(*) > 1;
```

Preserve a primeira resposta válida quando a ordem puder ser comprovada. O ID ajuda a ordenar a exportação. Em caso de empate no horário, confirme a ordem pelo histórico antes de corrigir. Reconstrua o agendamento e os contadores de progresso somente quando houver dados suficientes para reaplicar as revisões posteriores legítimas. Registre a comparação antes e depois por card e confirme que a consulta retorna zero duplicatas antes de reaplicar a migração.

Se uma tentativa anterior ficou registrada como falha no Prisma, verifique que a transação reverteu as alterações e use `prisma migrate resolve --rolled-back 20261123090000_review_session_integrity` antes de tentar novamente. Após migrar, confira a restrição de unicidade, os totais das sessões e o próximo agendamento das amostras. As sessões abertas anteriores à migração passam para `ABANDONED`, pois o modelo anterior guardava apenas o total planejado. Se a migração for bem-sucedida e a versão precisar voltar, suspenda novas escritas e use a restauração ensaiada com revisão dos dados gravados depois do backup.

No ensaio descartável, a migração recusou duas respostas para o mesmo card sem criar a nova coluna. O backup restaurado em outro banco manteve as duas respostas. Após reconciliar a duplicata da amostra, a migração aplicou a unicidade e preservou a primeira resposta, o total revisado de 1 e o agendamento original de 10 dias.

## Pipeline e dados

Os endpoints administrativos leem `seed/grammar/{nível}.json` da versão em execução. Inclua esse diretório no artefato da API. O `POST /admin/grammar-points/pipeline/run` aceita `validate` e `import`. Use `dryRun: true` para conferir a previsão e envie `Idempotency-Key` na importação real. Consulte os resultados em `pipeline/runs` e os pontos de reversão em `pipeline/rollbacks`. A reversão real também exige `Idempotency-Key`.

O seed N5 preserva os 40 IDs e identifica as frases didáticas originais por `sourceId`, com leitura e tradução. Os arquivos locais de N1 a N4 contêm etapas de preparação com exemplos ausentes e foram preservados. A validação na cópia da versão de referência com o N5 corrigido passou em 42 de 42 testes.

O build de produção local validou e importou os 40 pontos. O mesmo histórico e identificador da reversão continuaram disponíveis após encerrar e iniciar outro processo da API. O teste de limite com Redis retornou `429` ao exceder a cota configurada de 100 requisições.

## Evidência de API

As 66 operações do Swagger tiveram ao menos um cenário de sucesso. O histórico de execução do pipeline acrescentou uma operação à matriz original. Foram confirmadas 50 operações com JWT e 18 operações administrativas, incluindo o novo histórico. Login com entrada vazia e renovação sem credencial também devolveram `401`, como previsto pelos respectivos contratos.

| Operação | Respostas de sucesso | Visitante | Estudante / professor em rotas admin | Evidência |
| --- | --- | --- | --- | --- |
| `GET /` | 200 | 200 | — | Build local |
| `GET /admin/grammar-points` | 200 | 401 | 403 / 403 | Build local |
| `POST /admin/grammar-points` | 201 | 401 | 403 / 403 | E2E |
| `DELETE /admin/grammar-points/{id}` | 204 | 401 | 403 / 403 | E2E |
| `GET /admin/grammar-points/{id}` | 200 | 401 | 403 / 403 | E2E |
| `PUT /admin/grammar-points/{id}` | 200 | 401 | 403 / 403 | E2E |
| `PATCH /admin/grammar-points/{id}/status` | 200 | 401 | 403 / 403 | E2E |
| `POST /admin/grammar-points/pipeline/rollback` | 200 | 401 | 403 / 403 | E2E |
| `GET /admin/grammar-points/pipeline/rollbacks` | 200 | 401 | 403 / 403 | E2E |
| `POST /admin/grammar-points/pipeline/run` | 200 | 401 | 403 / 403 | E2E |
| `GET /admin/grammar-points/pipeline/runs` | 200 | 401 | 403 / 403 | E2E |
| `GET /admin/kanjis` | 200 | 401 | 403 / 403 | Build local |
| `POST /admin/kanjis` | 201 | 401 | 403 / 403 | E2E |
| `DELETE /admin/kanjis/{id}` | 204 | 401 | 403 / 403 | E2E |
| `PUT /admin/kanjis/{id}` | 200 | 401 | 403 / 403 | E2E |
| `GET /admin/vocabularies` | 200 | 401 | 403 / 403 | Build local |
| `POST /admin/vocabularies` | 201 | 401 | 403 / 403 | Build local |
| `DELETE /admin/vocabularies/{id}` | 204 | 401 | 403 / 403 | Build local |
| `PUT /admin/vocabularies/{id}` | 200 | 401 | 403 / 403 | Build local |
| `GET /analytics/overview` | 200 | 401 | — | E2E |
| `POST /auth/login` | 200 | 400 | — | E2E e build local |
| `POST /auth/logout` | 200 | 401 | — | E2E |
| `GET /auth/me` | 200 | 401 | — | E2E |
| `POST /auth/refresh` | 200 | 401 | — | E2E |
| `POST /auth/register` | 201 | 400 | — | E2E |
| `GET /dashboard/summary` | 200 | 401 | — | E2E |
| `GET /grammar` | 200 | 200 | — | E2E |
| `GET /grammar/{id}` | 200 | 404 | — | E2E |
| `POST /grammar/{id}/progress` | 200 | 401 | — | E2E |
| `GET /health` | 200 | 200 | — | Build local |
| `GET /health/live` | 200 | 200 | — | Build local |
| `GET /health/ready` | 200 | 200 | — | Build local |
| `GET /immersion` | 200 | 401 | — | E2E |
| `POST /immersion` | 201 | 401 | — | E2E |
| `DELETE /immersion/{id}` | 200 | 401 | — | E2E |
| `GET /immersion/{id}` | 200 | 401 | — | E2E |
| `PATCH /immersion/{id}` | 200 | 401 | — | E2E |
| `GET /kanji` | 200 | 200 | — | E2E |
| `GET /kanji/{id}` | 200 | 404 | — | E2E |
| `POST /kanji/{id}/progress` | 200 | 401 | — | Build local |
| `GET /kanji/search` | 200 | 400 | — | E2E |
| `GET /kanji/search/{query}` | 200 | 200 | — | E2E |
| `GET /planner/overview` | 200 | 401 | — | E2E e build local |
| `GET /planner/summary/today` | 200 | 401 | — | E2E |
| `GET /planner/tasks` | 200 | 401 | — | E2E |
| `POST /planner/tasks` | 201 | 401 | — | E2E e build local |
| `DELETE /planner/tasks/{id}` | 200 | 401 | — | E2E e build local |
| `GET /planner/tasks/{id}` | 200 | 401 | — | Build local |
| `PATCH /planner/tasks/{id}` | 200 | 401 | — | E2E |
| `PATCH /planner/tasks/{id}/complete` | 200 | 401 | — | E2E |
| `GET /planner/tasks/{id}/history` | 200 | 401 | — | E2E |
| `GET /planner/week` | 200 | 401 | — | E2E |
| `PATCH /planner/weeks/{id}` | 200 | 401 | — | E2E |
| `PUT /planner/weeks/{id}/goals` | 200 | 401 | — | E2E |
| `GET /review/queue` | 200 | 401 | — | E2E |
| `GET /review/queue/count` | 200 | 401 | — | E2E |
| `POST /review/sessions` | 201 | 401 | — | E2E e build local |
| `GET /review/sessions/{id}` | 200 | 401 | — | Build local |
| `POST /review/sessions/{id}/abandon` | 200 | 401 | — | E2E e build local |
| `POST /review/sessions/{id}/answer` | 200 | 401 | — | E2E |
| `POST /review/sessions/{id}/end` | 200 | 401 | — | E2E |
| `GET /review/sessions/{id}/stats` | 200 | 401 | — | E2E |
| `GET /review/sessions/history` | 200 | 401 | — | E2E |
| `GET /vocabulary` | 200 | 200 | — | E2E |
| `GET /vocabulary/{id}` | 200 | 404 | — | E2E |
| `POST /vocabulary/{id}/progress` | 200 | 401 | — | E2E |

## Cenários corrigidos

| Caso | Ambiente e perfis | Resultado observado |
| --- | --- | --- |
| SRS-01 e SRS-02 | PostgreSQL com estudante e segunda conta | O reenvio devolveu a mesma resposta e deixou uma única linha de resposta. A disputa entre resposta e encerramento manteve as contagens do banco. O encerramento repetido devolveu as mesmas métricas. |
| GRA-01 a GRA-03 | PostgreSQL com visitante, estudante e administrador | Busca, detalhe e progresso ocultaram os quatro estados de edição. Após republicar o ponto, o progresso anterior voltou a aparecer. |
| N5-01 | PostgreSQL vazio e depois populado | O seed inseriu 40 pontos. A repetição manteve os IDs dos pontos e exemplos, o título editado, a publicação e o progresso de estudo. |
| PIPE-01 a PIPE-03 | PostgreSQL com administrador | A simulação deixou o catálogo intacto. Duas chamadas concorrentes com a mesma chave produziram uma operação. A reversão restaurou ponto e exemplos. Uma identidade ambígua no segundo registro desfez a escrita do primeiro. |
| WEB-01 | Playwright em viewport desktop e de 390 px | Estudo exibiu os mesmos itens por URL, menu e recarga. Após perder a sessão e entrar com a conta vazia, a tela exibiu a lista vazia dessa conta. |
| WEB-02 | Playwright em viewport desktop e de 390 px | As cinco avaliações enviaram 20, 40, 60, 80 e 100. Quatro estrelas reapareceram após editar e recarregar. A meta semanal exibiu os 84 minutos da amostra. |
| WEB-03 | Playwright em viewport de 390 px | Uma falha na leitura mostrou erro com opção de tentar novamente. Restaurar a rede recuperou a lista. A conta vazia exibiu o estado vazio. |
| WEB-04 e WEB-05 | Playwright em viewport desktop e de 390 px | Criar e concluir uma tarefa atualizou os totais. Reagendar para outra semana manteve a conclusão e a duração de 35 minutos após recarga. Cancelar e simular falha preservaram o último valor salvo. A exclusão atualizou o Dashboard. |

A API do Planner devolveu 23 de novembro para a conta em `America/Fortaleza` e 24 de novembro para a conta em `Pacific/Kiritimati` no mesmo instante. A tarefa reagendada manteve uma única transição de conclusão e passou a pertencer ao plano da nova semana.

No navegador, a revisão voltou ao segundo de dois cards após recarregar. Ao concluir, o PostgreSQL guardou exatamente duas respostas e confirmou a data devolvida pela API para o primeiro agendamento. O professor voltou ao Dashboard ao acessar uma rota administrativa. O administrador abriu os três painéis e criou registros de vocabulário e gramática. O rascunho de gramática devolveu `404` no detalhe público.

## Verificações da versão

- Backend com lint, formatação, tipos e build aprovados, além de 285 testes unitários e 111 E2E.
- Frontend com lint sem erros, tipos e build aprovados e 40 testes aprovados, incluindo a execução com um segredo externo definido.
- Next.js atualizado para `16.4.6` e Zod para `4.6.7` nos dois projetos. A auditoria npm das dependências de produção retornou zero alertas em ambos os projetos. [Release do Next.js](https://github.com/vercel/next.js/releases/tag/v16.4.6) · [Aviso de segurança do Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

Os ensaios de atualização e restauração usaram uma cópia descartável com o esquema anterior e dados representativos. A conferência com a base histórica real e a publicação são etapas pendentes da release.

## Revalidação da branch em 24/11/2026

O código em `e69b3c3`, sobre a base `da77efe`, passou em build, TypeScript, lint, formatação, 288 testes unitários, 113 E2E e 42 testes do pipeline de gramática. A base descartável aplicou as 17 migrações e o Prisma confirmou que o esquema aplicado coincide com `schema.prisma`. A suíte de gramática falha no diretório que contém os rascunhos locais de N1 a N4 com exemplos ausentes. Os 42 testes passam com os dados da branch.

| Fluxo | Reprodução na base | Resultado na candidata |
| --- | --- | --- |
| Swagger e catálogos | Progresso sem propriedades documentadas, fila sem schema, autenticação obrigatória na documentação de Kanji e filtros ausentes em Gramática. | Contratos conferidos no Swagger servido. A biblioteca aceitou `studied=true` e retornou os itens da conta correta. As leituras administrativas preservaram `401`, `403` e `200` por perfil. |
| Visibilidade de Gramática | O rascunho apareceu na busca e abriu com `200`. | A busca retornou zero e o detalhe retornou `404`. Os E2E cobriram progresso e republicação. |
| Sessão de revisão | Dois envios idênticos geraram duas avaliações. | Os envios retornaram a mesma resposta e geraram uma avaliação. O envio divergente retornou `409`. A conta vizinha recebeu `404` e o encerramento repetido devolveu o mesmo resultado. |
| Planner | A tarefa reagendada manteve o plano anterior. Uma data impossível retornou `201`. | A tarefa passou ao plano da semana de destino e manteve a conclusão, os 35 minutos e o histórico. A data impossível retornou `400`. |
| Imersão | O Swagger omitia que a avaliação podia ser limpa com `null`. | O Swagger descreveu o inteiro anulável. A leitura após editar e limpar conservou a duração e devolveu a avaliação vazia. |
| Pipeline e cota HTTP | O seed N5 versionado estava vazio e os resultados do pipeline não tinham histórico persistido. | N5 carregou 40 pontos e 40 exemplos. A API armazenou a validação no histórico administrativo. A cota retornou `429` com `Retry-After`, enquanto a prontidão e o catálogo responderam `200`. |

O backup da base descartável restaurou as duas respostas duplicadas. A migração de revisão recusou a duplicata, deixou as duas respostas intactas e não criou a coluna `cards`. O aceite da migração na base histórica depende da conferência dos duplicados e dos agendamentos descrita acima.
