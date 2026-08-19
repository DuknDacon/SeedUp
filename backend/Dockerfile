# syntax=docker/dockerfile:1
#
# SeedUp 기능② 로드맵 백엔드 이미지.
# Roadmap-Agent는 별도 레포에서 자체적으로 빌드된 이미지를 베이스로 그대로 가져다 쓴다.
# 그래서 이 이미지를 빌드하는 쪽(서버)은 Roadmap-Agent 레포를 clone할 필요가 없다 —
# 레지스트리 대신 이미지 파일(tar)을 직접 받아 `docker load`로 로컬에 올려둔다.
#
# 사전 준비 (Roadmap-Agent 레포 쪽에서 먼저 빌드해 파일로 전달):
#   docker build -t roadmap-agent:<tag> .
#   docker save -o roadmap-agent-<tag>.tar roadmap-agent:<tag>
#   (파일 전송 후, 이 이미지를 빌드할 서버에서) docker load -i roadmap-agent-<tag>.tar
#
# 이 이미지 빌드 (이 폴더, SeedUp/backend/ 에서 실행):
#   docker build --build-arg ROADMAP_AGENT_IMAGE=roadmap-agent:<tag> \
#     -t seedup-roadmap-backend .
ARG ROADMAP_AGENT_IMAGE=roadmap-agent:latest
FROM ${ROADMAP_AGENT_IMAGE}

WORKDIR /app

# SeedUp/backend (FastAPI 어댑터). .env 파일은 절대 복사하지 않는다 — 런타임에 주입한다.
COPY requirements.txt /app/backend/requirements.txt
COPY app /app/backend/app

RUN pip install --no-cache-dir -r /app/backend/requirements.txt

ENV PYTHONUNBUFFERED=1
EXPOSE 8001

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
