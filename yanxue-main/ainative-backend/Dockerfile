FROM docker.yc345.tv/7to12/golang:1.23.7-alpine3.20-base AS builder

ADD . /root
WORKDIR /root

ENV GOPROXY=https://goproxy.cn,direct \
    GOPRIVATE=gitlab.yc345.tv

RUN ssh-keyscan -t rsa gitlab.yc345.tv > ~/.ssh/known_hosts &&\
    git config --global url."ssh://git@gitlab.yc345.tv/".insteadOf "https://gitlab.yc345.tv/"

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    make build


FROM docker.yc345.tv/7to12/alpine-timezone:3.15 as cli

COPY --from=builder /root/bin /app

WORKDIR /app

EXPOSE 9000
EXPOSE 8000
ADD ./configs /src/configs

CMD ["./yanxue", "-conf", "/src/configs"]