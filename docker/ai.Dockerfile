# AI 服务镜像（FastAPI + Uvicorn）
FROM python:3.11-slim
ARG CN_MIRROR=false
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LANG=C.UTF-8 \
    TZ=Asia/Shanghai
RUN mkdir -p /app/AI_consultant/memories
# 国内构建时切换 pip 镜像源（清华），加速依赖下载；国外 CI 默认 false 用官方源
RUN if [ "$CN_MIRROR" = "true" ]; then pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple; fi
# 依赖在仓库根目录的 requirements.txt
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY AI_consultant/ /app/AI_consultant/
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "api:app", "--app-dir", "/app/AI_consultant", "--host", "0.0.0.0", "--port", "8000"]
