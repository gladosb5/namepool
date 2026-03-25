FROM rust:1.84-bookworm AS builder

ARG commitHash=local
ENV MEMPOOL_COMMIT_HASH=${commitHash}

RUN apt-get update && \
    apt-get install -y curl ca-certificates build-essential python3 pkg-config && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs=22.14.0-1nodesource1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build/backend

COPY backend/ ./
COPY rust/ /build/rust/
COPY docker/backend/mempool-config.json docker/backend/start.sh docker/backend/wait-for-it.sh ./

RUN mkdir -p GeoIP && \
    curl -fsSL https://raw.githubusercontent.com/mempool/geoip-data/master/GeoLite2-City.mmdb -o GeoIP/GeoLite2-City.mmdb && \
    curl -fsSL https://raw.githubusercontent.com/mempool/geoip-data/master/GeoLite2-ASN.mmdb -o GeoIP/GeoLite2-ASN.mmdb

ENV PATH="/usr/local/cargo/bin:$PATH"

RUN npm install --omit=dev --omit=optional && \
    npm run package

FROM rust:1.84-bookworm AS runtime

RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs=22.14.0-1nodesource1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/backend/package ./package/
COPY --from=builder --chown=1000:1000 /build/backend/GeoIP ./GeoIP/
COPY --from=builder --chown=1000:1000 /build/backend/mempool-config.json /build/backend/start.sh /build/backend/wait-for-it.sh ./

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]
