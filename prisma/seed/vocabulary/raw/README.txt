Coloque aqui o arquivo jmdict-simplified-*.json baixado de:
https://github.com/scriptin/jmdict-simplified/releases

Nome recomendado: jmdict-simplified.json
(Tamanho aproximado: ~200MB)

Ou a versão em inglês apenas: jmdict-simplified-eng.json

Após baixar, verifique o caminho no script:
  backend/prisma/seed-vocabulary.ts
  → chama loadSeedVocabulary() que procura em:
    - backend/prisma/seed/vocabulary/raw/jmdict-simplified.json
    - backend/prisma/seed/vocabulary/jmdict-simplified.json
    - backend/data/jmdict-simplified.json
