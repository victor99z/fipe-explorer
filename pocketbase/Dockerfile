FROM alpine:3.21

ARG PB_VERSION=0.25.9

RUN apk add --no-cache ca-certificates unzip wget

WORKDIR /pb

RUN ARCH=$(uname -m) && \
    case "${ARCH}" in \
      x86_64) PB_ARCH="amd64" ;; \
      aarch64|arm64) PB_ARCH="arm64" ;; \
      *) echo "Unsupported arch: ${ARCH}" && exit 1 ;; \
    esac && \
    wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" && \
    unzip /tmp/pb.zip -d /pb && \
    rm -f /tmp/pb.zip && \
    chmod +x /pb/pocketbase

COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

EXPOSE 8090

ENTRYPOINT ["/pb/entrypoint.sh"]
