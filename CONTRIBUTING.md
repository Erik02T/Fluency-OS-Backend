# 🤝 Contributing

Obrigado pelo interesse em contribuir com o Fluency OS!

Este documento descreve os padrões de desenvolvimento utilizados no projeto para manter a consistência, qualidade e organização do código.

---

# Pré-requisitos

Antes de contribuir, tenha instalado:

- Node.js >= 20
- PostgreSQL 16
- Redis 7
- Docker
- Git

---

# Configuração do ambiente

Clone o repositório:

```bash
git clone https://github.com/Erik02T/fluency-os-backend.git
```

Entre na pasta:

```bash
cd fluency-os-backend
```

Instale as dependências:

```bash
npm install
```

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

Suba os containers:

```bash
docker compose up -d
```

Execute as migrations:

```bash
npx prisma migrate dev
```

Inicie o projeto:

```bash
npm run start:dev
```

---

# Fluxo de Trabalho

## 1. Faça um Fork

Crie um Fork do projeto em sua conta do GitHub.

---

## 2. Crie uma Branch

Nunca trabalhe diretamente na `main`.

Exemplo:

```bash
git checkout -b feature/auth
```

ou

```bash
git checkout -b feature/kanji-search
```

---

## 3. Faça Commits

Utilizamos o padrão **Conventional Commits**.

Exemplos:

```text
feat: add JWT authentication

fix: resolve refresh token validation

refactor: simplify review service

docs: update README

test: add auth service tests

chore: update dependencies
```

---

## 4. Execute os testes

Antes de enviar alterações execute:

```bash
npm run lint

npm run test

npm run build
```

O projeto deve estar sem erros.

---

## 5. Abra um Pull Request

Após finalizar:

- Faça Push
- Abra um Pull Request
- Descreva claramente as alterações

---

# Padrões de Código

O projeto utiliza:

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- ESLint
- Prettier

Todos os arquivos devem seguir os padrões definidos pelo ESLint e Prettier.

---

# Estrutura dos Módulos

Cada módulo deve seguir a seguinte organização:

```text
auth/

auth.module.ts

auth.controller.ts

auth.service.ts

auth.repository.ts

dto/

entities/

guards/

strategies/
```

Novos módulos devem seguir esse padrão.

---

# Estrutura de Branches

```text
main

develop

feature/*

fix/*

hotfix/*
```

---

# Pull Requests

Todo Pull Request deve:

- possuir descrição clara;
- resolver apenas um problema por vez;
- manter compatibilidade com o restante do sistema;
- passar em todos os testes.

---

# Documentação

Sempre que uma nova funcionalidade for adicionada:

- atualizar o README (se necessário);
- atualizar a documentação em `docs/`;
- atualizar o CHANGELOG.

---

Obrigado por contribuir com o Fluency OS! 🚀