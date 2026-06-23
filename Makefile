# Makefile — atomcam_tools
# ビルドプロファイル: make help / make configure / make build PROFILE=harness
.SILENT:

DOCKER_IMAGE=$(shell sed -ne 's>^.*image:[ \t]*>>p' docker-compose.yml)
DOCKER_ARCH=-$(shell uname -m | sed 's>x86_64>amd64>g; s>aarch64>arm64>g')
BUILDROOT_DIR=/atomtools/build/buildroot-2026.02.1
BR2_EXTERNAL=/src/custompackages
PROFILE ?=
BUILD_PROFILE_SCRIPT=./scripts/make/build-profile.sh

.DEFAULT_GOAL := help

define check_container_running
	$(DOCKER_COMPOSE) ls | grep atomcam_tools > /dev/null
endef

DOCKER_COMPOSE=$(shell \
	if command -v docker-compose >/dev/null 2>&1; then \
		echo "docker-compose"; \
	elif docker compose version >/dev/null 2>&1; then \
		echo "docker compose"; \
	else \
		echo "docker compose"; \
	fi)

.PHONY: help profile-list profile-show configure profile-apply \
	build build-local build-simple build-tailscale build-hil build-cyclo \
	build-harness build-agent build-full post-build-profile-local \
	docker-build menuconfig linux-menuconfig busybox-menuconfig linux-rebuild \
	savedefconfig login lima deploy deploy-test sim-swing sim-swing-92m \
	clean distclean sd-package sd-package-verify hil-status hil-deploy-test \
	hil-debug-loop agent-hint

help:
	echo "atomcam_tools make — ビルドプロファイル対応"
	echo ""
	echo "  初めて / エージェントなし:  make configure"
	echo "  標準ビルド（Tailscale 既定）: make build"
	echo "  プロファイル指定:           make build PROFILE=harness"
	echo ""
	echo "プロファイル:"
	$(BUILD_PROFILE_SCRIPT) list
	echo ""
	echo "ビルド:"
	echo "  build              コンテナ内フルビルド（PROFILE 未設定なら tailscale）"
	echo "  build-local        同上（エイリアス）"
	echo "  build-simple       Tailscale 無効の最小ビルド"
	echo "  build-hil          HIL 開発（SD ブートストラップ資産）"
	echo "  build-cyclo        HIL サイクル（hil と同じ）"
	echo "  build-harness      反復デバッグループ（mmc テンプレ + sd-package）"
	echo "  build-agent        harness + デバッグ SSH 鍵"
	echo "  build-full         すべて有効"
	echo ""
	echo "プロファイル管理:"
	echo "  configure          対話式選択（Cursor 不要）"
	echo "  profile-list       一覧"
	echo "  profile-show       現在または PROFILE=name で詳細"
	echo "  agent-hint         Cursor エージェント検出"
	echo ""
	echo "HIL / デプロイ:"
	echo "  release-info       次ビルドの版付き zip 名を表示"
	echo "  artifacts          最新成果物一覧"
	echo "  hil-status         実機 status（ATOMCAM_HOST）"
	echo "  hil-deploy-test    deploy-test ループ"
	echo "  hil-debug-loop     probe → recover → deploy-test"
	echo ""
	echo "Cursor エージェントあり: チャットで「PROFILE=harness で build」と依頼可"
	echo "エージェントなし:        make configure → make build"

agent-hint:
	chmod +x $(BUILD_PROFILE_SCRIPT) ./scripts/make/agent-detect.sh
	./scripts/make/agent-detect.sh --banner

profile-list:
	chmod +x $(BUILD_PROFILE_SCRIPT)
	$(BUILD_PROFILE_SCRIPT) list

profile-show:
	chmod +x $(BUILD_PROFILE_SCRIPT)
	@if [ -n "$(PROFILE)" ]; then \
		$(BUILD_PROFILE_SCRIPT) show $(PROFILE); \
	else \
		$(BUILD_PROFILE_SCRIPT) current; \
	fi

configure:
	chmod +x scripts/make/*.sh
	$(BUILD_PROFILE_SCRIPT) configure

profile-apply:
	chmod +x scripts/make/*.sh
	@if [ -n "$(PROFILE)" ]; then \
		$(BUILD_PROFILE_SCRIPT) apply $(PROFILE); \
	else \
		$(BUILD_PROFILE_SCRIPT) ensure; \
	fi

post-build-profile-local:
	chmod +x scripts/make/*.sh scripts/hil/sd-package.sh
	./scripts/make/post-build-profile.sh

build-simple:
	$(MAKE) build PROFILE=simple

build-tailscale:
	$(MAKE) build PROFILE=tailscale

build-hil:
	$(MAKE) build PROFILE=hil

build-cyclo:
	$(MAKE) build PROFILE=cyclo

build-harness:
	$(MAKE) build PROFILE=harness

build-agent:
	$(MAKE) build PROFILE=agent

build-full:
	$(MAKE) build PROFILE=full

build: profile-apply
	docker image inspect ${DOCKER_IMAGE} > /dev/null 2>&1 || $(MAKE) docker-build
	$(call check_container_running) || $(DOCKER_COMPOSE) up -d
	$(DOCKER_COMPOSE) exec builder /src/buildscripts/build_all | \
		tee rebuild_`date +"%Y%m%d_%H%M%S"`.log
	$(MAKE) post-build-profile-local
	$(MAKE) canonical-zip

build-local: build

docker-build:
	docker build -t ${DOCKER_IMAGE} -t ${DOCKER_IMAGE}${DOCKER_ARCH} . | \
		tee docker-build_`date +"%Y%m%d_%H%M%S"`.log

menuconfig linux-menuconfig busybox-menuconfig linux-rebuild:
	$(call check_container_running) || $(DOCKER_COMPOSE) up -d
	$(DOCKER_COMPOSE) exec builder \
		make -C $(BUILDROOT_DIR) BR2_EXTERNAL=$(BR2_EXTERNAL) $@

savedefconfig:
	$(call check_container_running) || $(DOCKER_COMPOSE) up -d
	$(DOCKER_COMPOSE) exec builder \
		make -C $(BUILDROOT_DIR) BR2_EXTERNAL=$(BR2_EXTERNAL) \
		savedefconfig BR2_DEFCONFIG=/src/configs/atomcam_defconfig

login:
	$(call check_container_running) || $(DOCKER_COMPOSE) up -d
	$(DOCKER_COMPOSE) exec builder bash

lima:
	[ "`uname -s`" = "Darwin" ] || exit 0
	[ -d ~/.lima/lima-docker ] || \
		( limactl start --tty=false lima-docker.yml && exit 0 )
	[ "`limactl list | awk '/lima-docker/ { print $2 }'`" = "Running" ] || \
		limactl start lima-docker

ATOMCAM_HOST ?= atomcam.local

deploy:
	chmod +x ./scripts/deploy_remote.sh
	./scripts/deploy_remote.sh $(ATOMCAM_HOST)

deploy-test: deploy
	chmod +x ./scripts/smoke_test_remote.sh
	./scripts/smoke_test_remote.sh $(ATOMCAM_HOST)

sim-swing:
	chmod +x ./scripts/sim_atomswing.sh
	./scripts/sim_atomswing.sh swing-80m

sim-swing-92m:
	chmod +x ./scripts/sim_atomswing.sh
	./scripts/sim_atomswing.sh swing-92m

clean:
	$(call check_container_running) && \
		$(DOCKER_COMPOSE) exec builder make -C $(BUILDROOT_DIR) clean

distclean:
	$(DOCKER_COMPOSE) down --volumes --remove-orphans
	docker image rm ${DOCKER_IMAGE} ${DOCKER_IMAGE}${DOCKER_ARCH} 2>/dev/null || :

canonical-zip:
	chmod +x ./scripts/hil/sd-package.sh ./scripts/make/stage-release.sh ./scripts/make/build-metadata.sh
	./scripts/hil/sd-package.sh || echo "canonical-zip: sd-package warning (secrets?)" >&2

sd-package:
	chmod +x ./scripts/hil/sd-package.sh
	./scripts/hil/sd-package.sh

sd-package-verify: sd-package
	chmod +x ./scripts/hil/sd-package-verify.sh
	./scripts/hil/sd-package-verify.sh

hil-status:
	chmod +x ./scripts/hil/true-hil.sh ./scripts/deploy_remote.sh
	./scripts/hil/true-hil.sh status

hil-deploy-test:
	chmod +x ./scripts/hil/true-hil.sh ./scripts/deploy_remote.sh ./scripts/smoke_test_remote.sh
	./scripts/hil/true-hil.sh deploy-test

release-info:
	chmod +x scripts/make/build-metadata.sh
	@echo "=== next artifact names (from current git state) ==="
	$(BUILD_PROFILE_SCRIPT) current 2>/dev/null || true
	./scripts/make/build-metadata.sh print-json

artifacts:
	@echo "=== stable symlinks ==="
	ls -la atomcam_tools.zip target/sd_initial.zip target/BUILD_MANIFEST.json target/LATEST.txt 2>/dev/null || true
	@echo "=== releases/ ==="
	ls -la target/releases/ 2>/dev/null | tail -20 || echo "(none yet)"

hil-debug-loop:
	chmod +x ./scripts/hil/debug-hil-loop.sh
	ATOMCAM_HOST=$(or $(ATOMCAM_HOST),10.0.0.228) ./scripts/hil/debug-hil-loop.sh loop
