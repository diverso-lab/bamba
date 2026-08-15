.PHONY: env up up-d down build logs restart prod prod-ai prod-logs prod-down clean clean-all lock ai

env:           ## Crea .env desde .env.example con SECRET_KEY aleatoria (no sobreescribe)
	@if [ -f .env ]; then echo ".env ya existe (no se toca)"; else \
	  sed "s/^SECRET_KEY=.*/SECRET_KEY=$$(openssl rand -hex 32)/" .env.example > .env && echo ".env creado con SECRET_KEY aleatoria"; fi

up:            ## Levanta el entorno de desarrollo (hot reload)
	docker compose up --build

up-d:          ## Igual que up pero en segundo plano
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

prod:          ## Build de producción (nginx) en 127.0.0.1:8080 (configurable en .env)
	docker compose -f docker-compose.prod.yml up --build -d

prod-ai:       ## Producción + IA de texto local (Ollama)
	docker compose -f docker-compose.prod.yml --profile ai up --build -d

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-down:
	docker compose -f docker-compose.prod.yml down

clean:         ## Borra contenedores e imágenes de desarrollo (conserva tus datos y los modelos)
	docker compose down --rmi local

clean-all:     ## ¡Borra TODO, incluidos tus diseños/usuarios (volumen bamba-data) y los modelos!
	@echo "Esto eliminará todos los usuarios, diseños y subidas. Ctrl+C para cancelar."; sleep 5
	docker compose down -v --rmi local

lock:          ## Regenera frontend/package-lock.json dentro del contenedor
	docker compose exec -T frontend npm install --package-lock-only --no-audit --no-fund

ai:            ## Levanta también la IA de texto local (Ollama + modelo pequeño, ~1 GB)
	docker compose --profile ai up -d
