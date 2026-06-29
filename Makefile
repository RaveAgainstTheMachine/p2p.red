SHELL := /bin/bash

.PHONY: deploy-all deploy-and-test public-sync publish-github help

help:
	@echo "Available targets:"
	@echo "  deploy-all                 Run full deploy (metadata + app)"
	@echo "  deploy-and-test            Deploy and run health checks"
	@echo "  public-sync PUBLIC_REPO=…  Sync dev repo to public repo"
	@echo "  publish-github PUBLIC_REPO=… Sanitize, verify, and commit to public repo"

deploy-all:
	./automation/deploy-all.sh

deploy-and-test:
	./automation/deploy-and-test.sh

public-sync:
	@if [ -z "$(PUBLIC_REPO)" ]; then \
		echo "PUBLIC_REPO is required. Example: make public-sync PUBLIC_REPO=/path/to/public-repo"; \
		exit 1; \
	fi
	PUBLIC_REPO="$(PUBLIC_REPO)" ./automation/public-sync.sh

publish-github:
	@if [ -z "$(PUBLIC_REPO)" ]; then \
		echo "PUBLIC_REPO is required. Example: make publish-github PUBLIC_REPO=/path/to/public-repo"; \
		exit 1; \
	fi
	PUBLIC_REPO="$(PUBLIC_REPO)" ./automation/publish-github.sh
