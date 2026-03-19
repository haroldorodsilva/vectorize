# ============================================================
# Vetorizador SVG — Root Makefile
# ============================================================
.PHONY: help install dev build backend-dev frontend-dev

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Instala dependências (backend + frontend)
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

backend-dev: ## Inicia backend FastAPI (porta 8080)
	cd backend && uvicorn server:app --reload --port 8080

frontend-dev: ## Inicia frontend Vite (porta 5173)
	cd frontend && npm run dev

dev: ## Inicia backend + frontend em paralelo
	@echo "Iniciando backend e frontend..."
	$(MAKE) backend-dev & $(MAKE) frontend-dev

build: ## Build do frontend para produção
	cd frontend && npm run build

backend-run: ## Inicia backend em produção
	@powershell -NoProfile -Command 'Get-NetTCPConnection -LocalPort 8080 -EA 0 | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $$_ -Force -EA 0 }'
	cd backend && uvicorn server:app --host 0.0.0.0 --port 8080
