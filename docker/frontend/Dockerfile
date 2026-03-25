FROM node:22.14.0-bookworm-slim AS builder

ARG commitHash=local
ENV DOCKER_COMMIT_HASH=${commitHash}
ENV CYPRESS_INSTALL_BINARY=0

RUN apt-get update && \
    apt-get install -y build-essential rsync && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build/frontend

COPY frontend/ ./
COPY docker/frontend/entrypoint.sh docker/frontend/wait-for ./
COPY nginx.conf nginx-namepool.conf ./

RUN cp namepool-frontend-config.sample.json namepool-frontend-config.json && \
    sed -i "s/127.0.0.1:80/0.0.0.0:__MEMPOOL_FRONTEND_HTTP_PORT__/g" nginx.conf && \
    sed -i "s/127.0.0.1/0.0.0.0/g" nginx.conf && \
    sed -i "s/user nobody;//g" nginx.conf && \
    sed -i "s!/etc/nginx/nginx-namepool.conf!/etc/nginx/conf.d/nginx-namepool.conf!g" nginx.conf && \
    sed -i "s/127.0.0.1:8999/__MEMPOOL_BACKEND_MAINNET_HTTP_HOST__:__MEMPOOL_BACKEND_MAINNET_HTTP_PORT__/g" nginx-namepool.conf && \
    npm install --omit=dev --omit=optional && \
    npm run build

FROM nginx:1.27.0-alpine

WORKDIR /patch

COPY --from=builder --chown=1000:1000 /build/frontend/entrypoint.sh /patch/entrypoint.sh
COPY --from=builder --chown=1000:1000 /build/frontend/wait-for /patch/wait-for
COPY --from=builder --chown=1000:1000 /build/frontend/dist/namepool /var/www/namepool
COPY --from=builder --chown=1000:1000 /build/frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder --chown=1000:1000 /build/frontend/nginx-namepool.conf /etc/nginx/conf.d/nginx-namepool.conf

RUN chmod +x /patch/entrypoint.sh /patch/wait-for && \
    chown -R 1000:1000 /var/cache/nginx && \
    chown -R 1000:1000 /var/log/nginx && \
    chown -R 1000:1000 /var/www/namepool && \
    touch /var/run/nginx.pid && \
    chown -R 1000:1000 /var/run/nginx.pid

USER 1000

ENTRYPOINT ["/patch/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
