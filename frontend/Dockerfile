FROM nginx:alpine
ARG BUILD_HASH=dev
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
# Inject build hash into index.html so browsers always fetch fresh assets
RUN sed -i "s/__BUILD__/${BUILD_HASH}/g" /usr/share/nginx/html/index.html
