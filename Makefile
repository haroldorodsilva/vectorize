# ============================================================
# Vetorizador de Imagens - Makefile
# ============================================================

.PHONY: help install run dev cli test clean docker docker-run lint format

PYTHON  ?= python3
PIP     ?= pip3
PORT    ?= 8080
WORKERS ?= 1
IMAGE   ?= vectorizer
VENV    ?= .venv

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Setup ────────────────────────────────────────────────────

venv: ## Cria virtualenv
	$(PYTHON) -m venv $(VENV)
	@echo "Ative com: source $(VENV)/bin/activate"

install: ## Instala dependências
	$(PIP) install -r requirements.txt
	@echo "\n✓ Dependências instaladas"

install-dev: install ## Instala dependências + dev
	$(PIP) install ruff pytest httpx
	@echo "\n✓ Dependências de dev instaladas"

# ── Executar ─────────────────────────────────────────────────

run: ## Inicia servidor de produção
	@echo "Liberando porta $(PORT)..."
	-powershell -NoProfile -Command 'Get-NetTCPConnection -LocalPort $(PORT) -EA 0 | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $$_ -Force -EA 0 }'
	@echo "Servidor em http://localhost:$(PORT)"
	uvicorn server:app --host 0.0.0.0 --port $(PORT)

dev: ## Inicia servidor de desenvolvimento (auto-reload)
	@echo "Dev server em http://localhost:$(PORT)"
	uvicorn server:app --reload --port $(PORT)

cli: ## Vetoriza imagem via CLI (uso: make cli IMG=imagem.png)
	$(PYTHON) main.py $(IMG) $(ARGS)

# ── Exemplos CLI ─────────────────────────────────────────────

example: ## Exemplo: vetoriza com parâmetros padrão
	$(PYTHON) main.py example.png --output example.svg --dilate 3
	@echo "\n✓ Abra example.svg no navegador"

example-thick: ## Exemplo: linhas grossas, mais fechamento
	$(PYTHON) main.py example.png --output example_thick.svg --dilate 5 --threshold 160

example-fine: ## Exemplo: linhas finas, menos fechamento
	$(PYTHON) main.py example.png --output example_fine.svg --dilate 2 --threshold 120 --simplify 1.0

# ── Docker ───────────────────────────────────────────────────

docker: ## Build imagem Docker
	docker build -t $(IMAGE) .
	@echo "\n✓ Imagem $(IMAGE) criada"

docker-run: ## Executa container Docker
	@echo "Servidor em http://localhost:$(PORT)"
	docker run -p $(PORT):8888 --rm --name vectorizer $(IMAGE)

docker-stop: ## Para container Docker
	docker stop vectorizer 2>/dev/null || true

# ── Qualidade ────────────────────────────────────────────────

lint: ## Verifica código com ruff
	ruff check vectorizer/ main.py server.py

format: ## Formata código com ruff
	ruff format vectorizer/ main.py server.py

test: ## Executa testes
	$(PYTHON) -m pytest tests/ -v

# ── Limpeza ──────────────────────────────────────────────────

clean: ## Remove arquivos temporários
	rm -rf __pycache__ vectorizer/__pycache__ .pytest_cache
	rm -rf *.svg output/
	@echo "✓ Limpo"

clean-all: clean ## Remove tudo (incluindo venv)
	rm -rf $(VENV)
	@echo "✓ Tudo limpo (incluindo venv)"
