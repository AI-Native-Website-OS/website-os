#!/usr/bin/env python3
"""
AI 服务统一启动入口：加载根目录 .env 后，按 PYTHON_HOST/PYTHON_PORT 启动 uvicorn。


所有配置均从环境变量 / 根目录 .env 读取（见 .env.example），无需硬编码 host/port。
"""
import os
import sys
import multiprocessing
from pathlib import Path

import dotenv
import uvicorn

# 与 db.py 保持一致：先加载 .env，再读取 PYTHON_HOST/PYTHON_PORT
for _env_path in [
    str(Path(__file__).resolve().parent.parent / ".env"),      # project-root/.env
    "/app/.env",                                               # Docker /app/.env
]:
    dotenv.load_dotenv(_env_path, override=False)

if __name__ == "__main__":
    host = os.getenv("PYTHON_HOST", "127.0.0.1")
    port = int(os.getenv("PYTHON_PORT", "8000"))
    reload_mode = "--reload" in sys.argv
    if reload_mode:
        uvicorn.run("api:app", host=host, port=port, reload=True)
    else:
        uvicorn.run("api:app", host=host, port=port, reload=False)