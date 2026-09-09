# 后端镜像（Spring Boot / Java 8）
# 构建阶段：使用 Maven 编译打包
FROM maven:3.9-eclipse-temurin-8 AS build
WORKDIR /build
# 先拷贝 pom 并预下载依赖，便于利用层缓存
COPY backend/pom.xml .
RUN mvn -B -q dependency:go-offline -DskipTests || true
COPY backend/ .
RUN mvn -B -q clean package -DskipTests

# 运行阶段：精简 JRE
FROM eclipse-temurin:8-jre
WORKDIR /app
ENV TZ=Asia/Shanghai \
    LANG=C.UTF-8
COPY --from=build /build/target/sinounion-website.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
