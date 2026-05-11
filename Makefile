# P2P File Share - Automation Makefile

.PHONY: help build test lint docker-build clean

help:
	@echo "Available commands:"
	@echo "  build         - Install dependencies and build frontend"
	@echo "  test          - Run all tests (frontend and backend)"
	@echo "  lint          - Run linters and type-checks"
	@echo "  docker-build  - Verify that all custom Docker images build successfully"
	@echo "  clean         - Remove build artifacts"

build:
	npm install
	npm run build
	cd metadata-api && npm install

lint:
	npm run lint
	npm run type-check

test:
	npm run test:unit
	cd metadata-api && npm test

docker-build:
	docker build -t p2p-app:test -f Dockerfile .
	docker build -t p2p-metadata-api:test -f Dockerfile.metadata-server .
	docker build -t p2p-peerjs:test -f Dockerfile.peerjs .
	docker build -t p2p-envoy:test -f Dockerfile.envoy .

clean:
	rm -rf dist
	rm -rf node_modules
	rm -rf metadata-api/node_modules
