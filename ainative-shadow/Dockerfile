FROM docker.yc345.tv/mirror/nginx:latest
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./dist /usr/share/nginx/html/trip-shadow
WORKDIR /etc/nginx
EXPOSE 80
