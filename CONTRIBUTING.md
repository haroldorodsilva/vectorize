# Contributing

Obrigado por considerar contribuir com o Vectorizer! Toda contribuicao e bem-vinda.

## Como Contribuir

### Reportar Bugs

1. Verifique se o bug ja nao foi reportado nas [Issues](../../issues)
2. Crie uma nova issue com:
   - Descricao clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots (se aplicavel)
   - Versao do Python, Node.js e sistema operacional

### Sugerir Features

1. Abra uma issue com a tag `enhancement`
2. Descreva a feature e o caso de uso
3. Se possivel, inclua mockups ou exemplos

### Enviar Pull Requests

1. Fork o repositorio
2. Crie uma branch para sua feature: `git checkout -b feature/minha-feature`
3. Faca suas alteracoes
4. Rode os testes: `cd backend && python -m pytest`
5. Commit suas mudancas: `git commit -m "feat: descricao da feature"`
6. Push para sua branch: `git push origin feature/minha-feature`
7. Abra um Pull Request

## Setup de Desenvolvimento

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Testes

```bash
cd backend
python -m pytest
```

### Lint / Typecheck

```bash
# Backend
cd backend
ruff check .

# Frontend
cd frontend
npm run typecheck
```

## Convencoes

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova funcionalidade
- `fix:` correcao de bug
- `docs:` alteracoes na documentacao
- `refactor:` refatoracao sem mudanca de comportamento
- `test:` adicao ou correcao de testes
- `chore:` tarefas de manutencao

### Codigo

- **Python**: PEP 8, type hints, docstrings em portugues
- **TypeScript**: strict mode, sem `any` desnecessario
- **Nomes**: variaveis e funcoes em ingles, comentarios e docs em portugues

### Branches

- `main` — branch principal, sempre estavel
- `feature/*` — novas funcionalidades
- `fix/*` — correcoes de bugs
- `docs/*` — atualizacoes de documentacao

## Estrutura do Projeto

```
backend/vectorizer/     # Pipeline de vetorizacao (Python/OpenCV)
frontend/src/features/  # Features do editor (React/TypeScript)
frontend/src/shared/    # Componentes UI reutilizaveis
docs/                   # Documentacao e GitHub Pages
```

## Codigo de Conduta

Este projeto segue o [Contributor Covenant](CODE_OF_CONDUCT.md). Ao participar, voce concorda em seguir este codigo de conduta.
