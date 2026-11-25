# Vocabulary Data — Fontes, Licenças e Processo de Importação

O [snapshot 1.0.0](../seed/catalogs/v1/manifest.json) contém 8.000 pares de palavra e leitura e 56.958 significados do catálogo local. Consulte o [guia de produção](production.md#carga-dos-catálogos-e-publicação-editorial) para exportar, validar e carregar os arquivos versionados.

## 1. Fontes Utilizadas

### 1.1 JMdict (Fonte principal — palavras, readings, meanings, part of speech)

- **Fonte oficial**: [Electronic Dictionary Research and Development Group (EDRDG)](http://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project)
- **Repositório do formato JSON simplificado usado aqui**: [scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified) (GitHub releases)
- **Arquivo JSON**: `jmdict-simplified.json` (versão com todos os idiomas, ou `jmdict-simplified-eng.json` com apenas inglês)
- **Licença**: [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/) — herdada do EDRDG/JMdict.
- **Atribuição obrigatória (MANTENHA ESTA LINHA AO DISTRIBUIR DERIVADOS)**:
  > The vocabulary data in this application is derived from the JMdict dictionary file, which was compiled by the Electronic Dictionary Research and Development Group (EDRDG), and is used in conformance with the Group's licence. See http://www.edrdg.org/ for more information.

### 1.2 Exemplos de Frases (Tatoeba — NÃO IMPORTADO AINDA, FASE FUTURA)

- **Fonte oficial**: [Tatoeba Project](https://tatoeba.org/)
- **Dados brutos**: https://downloads.tatoeba.org/exports/
  - `sentences.csv` — frases em vários idiomas
  - `links.csv` — mapeamento de paralelos (japonês ↔ inglês/português)
- **Licença**: [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) — requer atribuição "Tatoeba" e link.
- **Status**: Planejado para fase 2. Atualmente, a importação MVP deixa `vocabulary_examples` vazio (0 linhas).

### 1.3 JLPT Level

- **Política de qualidade**: `jlptLevel` é SEMPRE preenchido apenas com fonte confiável e explícita.
- **Estado atual (2026-08-10)**: `NULL` para 100% dos ~8.000 vocábulos importados. O JMdict NÃO é uma fonte oficial de classificação JLPT por palavra. Listas oficiais da JLPT não são públicas e o Nihongo no Noryoku Shiken não divulga vocabulário cobrado.
- **Atribuição manual futura permitida**: Se você (como administrador) for cadastrar palavras pela interface administrativa e souber de fonte confiável, preencha o campo. Exemplos: 「食べる」 N5,「学生」N5 etc. — não invente para as demais.

### 1.4 Frequência

- **Política**: Nunca inventar números. `frequency` é um ranking (menor = mais comum).
- **Estado atual (2026-08-10)**: `NULL` para 100% das palavras. O formato `jmdict-simplified` não contém ranking de frequência numérico, apenas flag booleana `common: boolean`.
- **Fonte recomendada para futuro (opcional)**:
  - [Innocent Corpus](https://github.com/taishi-i/wordfreq-ja) / [Frequency Words from Innocent Corpus](http://www.nat.c.u-tokyo.ac.jp/innocent/) com ~500k tokens de legendas de animes/dramas.
  - [jpdb frequency list](https://jpdb.io/top-10000-japanese-words) (uso educacional — verificar licença antes de importar).

## 2. Processo de Geração / Importação

### 2.1 Pipeline completo

```
┌─────────────────────────────┐
│  jmdict-simplified.json     │  ← RAW DATA: 1 arquivo, ~220MB, ~180k entradas
└──────────────────┬──────────┘
                   ▼
  src/modules/vocabulary/seed/vocabulary-parser.ts
     (parseJmdictDictionary / parseJmdictWord)
     - Extrai kanji, kana, glosses em inglês, pos tags
     - Filtra nomes próprios (surname, given, place etc.)
     - Uma entrada JMdict → N combinações (kanji + kana)
                   ▼
  src/modules/vocabulary/seed/vocabulary-normalizer.ts
     (normalizeRawEntries)
     - Unicode NFC
     - Trim + collapse de espaços
     - Deduplicação interna de meanings
     - Score de seleção (common, rare, field tags, dialetos)
     - Simplificação POS: ["v1"] → "verb (ichidan)"
                   ▼
  src/modules/vocabulary/seed/vocabulary-validator.ts
     (validateNormalizedEntries + dedupeByWordAndReading)
     - Garante word e reading NÃO VAZIOS
     - Garante pelo menos 1 meaning
     - Tamanhos <= limites do Prisma schema (VarChar 100, 200, 300)
     - Deduplicação final por (word, reading) composto
                   ▼
  src/modules/vocabulary/seed/vocabulary-selector.ts
     (selectTopVocabulary)
     - TOP 8.000 por:
       1. selectionScore desc (common > rare, field/dialeto penalizado)
       2. isCommon (kanji/kana marcado como "common")
       3. número de meanings (mais significados = melhor para estudo)
       4. localeCompare ja
                   ▼
  src/modules/vocabulary/seed/vocabulary-transformer.ts
     (transformToPrismaData)
     - NormalizedEntry → formato do Prisma (VocabularyCreateInput)
     - Primeiro meaning = isPrimary: true, position 0
     - Todos os campos são nullable onde schema permite
                   ▼
  npm run db:seed:vocabulary -- --raw-jmdict  (modo legado de desenvolvimento)
     - Carrega o pipeline e verifica pares existentes de palavra e leitura
     - Insere novos vocábulos, significados e exemplos em lotes
                   ▼
  PostgreSQL via Prisma
     ├─ vocabulary            (unique [word, reading])
     ├─ vocabulary_meanings   (FK para vocabulary.id)
     └─ vocabulary_examples   (atualmente vazio, 0 linhas)
```

### 2.2 Carregar o catálogo versionado

Com o Prisma Client gerado e a conexão de destino em `DATABASE_URL`, execute a partir da raiz do backend.

```sh
npm run db:catalogs:validate
npm run db:seed:vocabulary
```

O seed valida o manifesto e carrega os registros de `seed/catalogs/v1/` em uma transação. A carga preserva registros existentes pelo ID ou pelo par palavra/leitura. JMdict bruto é uma entrada do pipeline de desenvolvimento. Use `npm run db:seed:vocabulary -- --raw-jmdict` para esse fluxo, com um arquivo listado nas instruções de `prisma/seed/vocabulary/raw/`.

## 3. Limitações Atuais e Riscos Conhecidos

1. **Idioma dos significados**: Apenas inglês (JMdict). Não há tradução para pt-BR. O usuário verá "to eat" em vez de "comer". Resolver isso exige outra fonte de dados ou API de tradução paga (ex: DeepL, Google Translate).
2. **Exemplos**: Zero frases importadas. Integração com Tatoeba requer etapa separada de matching (palavra ↔ frase contendo a palavra).
3. **JLPT NULL para tudo**: Necessário curadoria manual ou nova fonte (ex: lista oficial de vocabulário JLPT, se ficar pública).
4. **Frequência NULL para tudo**: Requer integração com Innocent Corpus ou jpdb.
5. **Audio URL**: Sem links de áudio. Requer integração com Forvo (API paga) ou Wiktionary.
6. **Formato do JSON foi alterado?** Sempre valide a versão do pacote `@scriptin/jmdict-simplified-types` no `package.json` contra a release do JSON baixado. Atualize o `package.json` se quebrar tipagem.

## 4. Arquivos de Código Criados

```
backend/
├── prisma/
│   ├── seed-vocabulary.ts               ← SCRIPT PRINCIPAL (ts-node)
│   └── seed/vocabulary/
│       └── raw/
│           └── README.txt                ← instruções para baixar o JSON
│
└── src/modules/vocabulary/seed/
    ├── index.ts
    ├── types.ts                          ← RawVocabularyEntry, Normalized... etc.
    ├── vocabulary-parser.ts              ← Parse JMdictWord → Raw entries
    ├── vocabulary-normalizer.ts          ← NFC, trim, score, POS simplificado
    ├── vocabulary-validator.ts           ← Campos obrigatórios / tamanhos
    ├── vocabulary-selector.ts            ← TOP 8.000 por score
    ├── vocabulary-transformer.ts         ← Entries → Prisma create inputs
    ├── jmdict-seed.ts                    ← loadSeedVocabulary() exported
    └── vocabulary-seed.spec.ts           ← Testes unitários do pipeline
```

## 5. Comandos Úteis de Verificação Pós-importação

```sql
-- Resumo por tabela:
SELECT COUNT(*) AS vocabulary_rows FROM vocabulary;
SELECT COUNT(*) AS meanings_rows   FROM vocabulary_meanings;
SELECT COUNT(*) AS examples_rows   FROM vocabulary_examples;

-- Distribuição JLPT:
SELECT "jlptLevel", COUNT(*)
  FROM vocabulary
 GROUP BY 1
 ORDER BY 1;

-- Top 20 palavras mais comuns (se frequency for populado futuramente):
SELECT word, reading, frequency
  FROM vocabulary
 WHERE frequency IS NOT NULL
 ORDER BY frequency ASC
 LIMIT 20;

-- Palavras sem nenhum meaning (dado corrompido):
SELECT v.id, v.word, v.reading
  FROM vocabulary v
  LEFT JOIN vocabulary_meanings vm ON vm."vocabularyId" = v.id
 WHERE vm.id IS NULL;

-- Verificar 食べる (auditoria manual de qualidade):
SELECT v.word, v.reading, v."jlptLevel", v."partOfSpeech",
       (SELECT COUNT(*) FROM vocabulary_meanings vm WHERE vm."vocabularyId" = v.id) AS meanings,
       (SELECT COUNT(*) FROM vocabulary_examples ve WHERE ve."vocabularyId" = v.id) AS examples
  FROM vocabulary v
 WHERE v.word = '食べる' AND v.reading = 'たべる';
```

## 6. Referências / Links Oficiais

- JMdict home (EDRDG): http://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
- jmdict-simplified releases (formato JSON): https://github.com/scriptin/jmdict-simplified/releases
- Tatoeba downloads: https://tatoeba.org/pt-br/downloads
- Pacote de tipos: https://www.npmjs.com/package/@scriptin/jmdict-simplified-types
- Licenças CC:
  - JMdict / CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
  - Tatoeba / CC BY 2.0 FR: https://creativecommons.org/licenses/by/2.0/fr/
