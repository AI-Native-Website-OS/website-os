# 前端镜像（Next.js 静态导出 + Nginx 反向代理）
# 构建阶段：编译并静态导出
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# output: 'export' 默认导出到 out/，本项目 distDir 设为 dist（仅构建缓存）。
# 为兼容两种可能，统一把静态产物整理到 /export。
RUN npm run build && \
    if [ -d out ]; then cp -r out/. /export; \
    elif [ -d dist ]; then cp -r dist/. /export; \
    else echo "静态导出目录不存在(out/ 或 dist/)"; exit 1; fi

# 运行阶段：Nginx 提供静态文件并代理 API
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /export /usr/share/nginx/html
EXPOSE 80
