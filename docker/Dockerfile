# dsh-purge 隔离校验镜像
# 目的：在干净容器里跑语法/结构测试与 CLI 自检，容器里没有 dsh、没有网络，
# 所以 --apply 打不到任何宿主。本机 dsh 安装不会被碰。
FROM node:22-bookworm-slim

WORKDIR /w
COPY . /w
ENV DSH_HOME=/tmp/dsh-home-empty \
    DSH_BASE=/nonexistent-dsh-base \
    NO_COLOR=1

RUN mkdir -p /tmp/dsh-home-empty
ENTRYPOINT ["bash", "docker/smoke.sh"]
