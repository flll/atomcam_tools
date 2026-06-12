# Makefile
.SILENT:

DOCKER_IMAGE=$(shell sed -ne 's>^.*image:[ \t]*>>p' docker-compose.yml)
DOCKER_ARCH=-$(shell uname -m | sed 's>x86_64>amd64>g; s>aarch64>arm64>g')
BUILDROOT_DIR=/atomtools/build/buildroot-2026.02.1
BR2_EXTERNAL=/src/custompackages

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

build:
	docker image inspect ${DOCKER_IMAGE} > /dev/null 2>&1 || $(MAKE) docker-build

	$(call check_container_running) || $(DOCKER_COMPOSE) up -d

	$(DOCKER_COMPOSE) exec builder /src/buildscripts/build_all | \
		tee rebuild_`date +"%Y%m%d_%H%M%S"`.log

build-local:
	$(call check_container_running) || $(DOCKER_COMPOSE) up -d

	$(DOCKER_COMPOSE) exec builder /src/buildscripts/build_all | \
		tee rebuild_`date +"%Y%m%d_%H%M%S"`.log

docker-build:
	docker build -t ${DOCKER_IMAGE} -t ${DOCKER_IMAGE}${DOCKER_ARCH} . | \
		tee docker-build_`date +"%Y%m%d_%H%M%S"`.log

# Buildroot のターゲットをコンテナ内で実行するラッパー
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
