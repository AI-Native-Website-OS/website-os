## 以docker-compose形式运行服务

### 第一步：修改.env文件

将项目根目录下的`.env.example`复制到docker目录下

```bash
cd docker
cp ../.env.example .env
```

> 如有特殊需求，其他配置项请参考`.env.example`中的提示自行调整。

```bash
# 可将以下内容直接覆盖env文件默认配置
# ===== 数据库 =====
PG_HOST=sino-website-postgresql
PG_PORT=5432
PG_DATABASE=sinounion
PG_USER=root
PG_PASSWORD=sinounion

# ===== Redis =====
REDIS_HOST=sino-website-redis
REDIS_PORT=6379
REDIS_PASSWORD=sinoredis

# ===== AI 服务 =====
PYTHON_HOST=sino-website-ai

# ===== 后端 =====
BACKEND_HOST=0.0.0.0

# ===== 前端 =====
FRONTEND_PORT=3200

# ===== docker 镜像源 =====
REGISTRY=ghcr.1ms.run/ai-native-website-os/website-os
```

### 第二步：运行服务

> 本地无镜像时会 build 编译源码构建镜像，如果想使用预构建好的 docker 镜像快速启动，请执先行 docker compose pull

```bash
# 从源码构建Docker镜像：如果官方源构建速度慢,请在 .env 文件内添加配置 `CN_MIRROR=true` 以控制 npm/pip/maven 切换使用国内源
# docker compose up -d --build

docker compose pull && docker compose up -d
```

### 查看日志

```bash
#java后端日志
docker compose logs -f sino-website-backend

#python后端日志
docker compose logs -f sino-website-ai

#前端日志
docker compose logs -f sino-website-frontend
```

### 如需更新版本

```bash
# 拉取最新镜像
docker compose pull

# 启用服务
docker compose up -d --force-recreate
```
