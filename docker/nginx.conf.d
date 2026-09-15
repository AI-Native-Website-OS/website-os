server {
    listen 80;
    server_name localhost;

    location /api {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE / 长连接：关闭缓冲，拉长超时，避免被 nginx 掐断
        proxy_connect_timeout 6000s;
        proxy_read_timeout 6000s;
        proxy_send_timeout 6000s;
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;
        chunked_transfer_encoding on;
    }

    location /ai {
        proxy_pass http://ai:8000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE / 长连接：关闭缓冲，拉长超时，避免被 nginx 掐断
        proxy_connect_timeout 6000s;
        proxy_read_timeout 6000s;
        proxy_send_timeout 6000s;
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;
        chunked_transfer_encoding on;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
