server {
    listen 80;
    server_name localhost;

    location /api {
        proxy_pass http://backend:8080;
    }

    location /ai {
        proxy_pass http://ai:8000;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
