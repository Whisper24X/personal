package main

import (
	"flag"
	"fmt"
	"gitlab.yc345.tv/backend/yanxue/internal/server"
	"os"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/env"
	"github.com/go-kratos/kratos/v2/config/file"
	_ "github.com/go-kratos/kratos/v2/encoding/json"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/registry"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
	"gitlab.yc345.tv/backend/go-logger/logger"
	"gitlab.yc345.tv/backend/utils/v2/observer"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	tracingcommon "gitlab.yc345.tv/security-and-payment/tracing/common"
	_ "go.uber.org/automaxprocs"
)

// go build -ldflags "-X main.Version=x.y.z"
var (
	// Version is the version of the compiled software.
	Version string
	// flagconf is the config flag.
	flagconf string

	id, _ = os.Hostname()
)

//nolint:gochecknoinits
func init() {
	flag.StringVar(&flagconf, "conf", "../../configs", "config path, eg: -conf default.yaml")
}

func newApp(c *conf.Bootstrap, l log.Logger, r registry.Registrar, hs *http.Server, gs *grpc.Server, cs *server.Cron) *kratos.App {
	options := []kratos.Option{
		kratos.ID(id),
		kratos.Name(c.Name),
		kratos.Version(Version),
		kratos.Metadata(map[string]string{}),
		kratos.Logger(l),
		kratos.Server(
			hs,
			gs,
			cs,
			observer.NewServer(),
		),
	}
	if c.GetEnv() != conf.GO_ENV_local {
		options = append(options, kratos.Registrar(r))
	}
	return kratos.New(options...)
}

func main() {
	flag.Parse()
	// 加载配置
	c := config.New(
		config.WithSource(
			file.NewSource(flagconf+"/default.yaml"),
			file.NewSource(fmt.Sprintf("%s/%s.yaml", flagconf, os.Getenv("GO_ENV"))),
			env.NewSource(""),
		),
	)
	if err := c.Load(); err != nil {
		panic(err)
	}
	var bc conf.Bootstrap
	if err := c.Scan(&bc); err != nil {
		panic(err)
	}

	// 初始化日志
	l := log.With(logger.GetKratosLogger(),
		"msg", "",
		"service.id", id,
		"service.name", bc.Name,
		"service.version", Version,
		"trace_id", tracing.TraceID(),
		"span_id", tracing.SpanID(),
	)
	// 初始化链路追踪
	err := tracingcommon.Init(tracingcommon.SetupConfig{
		ServiceName: bc.Name,
		Version:     Version,
		Ratio:       1, // 采样率：全采样
	})
	if err != nil {
		panic(err)
	}
	defer tracingcommon.Shotdown()

	// app初始化
	app, cleanup, err := initApp(&bc, l)
	if err != nil {
		panic(err)
	}

	// 配置文件初始化
	err = conf.StartConfig(flagconf)
	if err != nil {
		panic(err)
	}
	defer cleanup()
	// start and wait for stop signal
	if err := app.Run(); err != nil {
		panic(err)
	}
}
