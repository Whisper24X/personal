//go:build wireinject
// +build wireinject

// The build tag makes sure the stub is not built in the final build.

package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/data"
	"gitlab.yc345.tv/backend/devices-learn/internal/server"
	"gitlab.yc345.tv/backend/devices-learn/internal/service"
)

// wireApp init kratos application.
func initApp(*conf.Bootstrap, log.Logger) (*kratos.App, func(), error) {
	panic(wire.Build(
		server.ProviderSet,
		data.ProviderSet,
		biz.ProviderSet,
		service.ProviderSet,
		newApp,
	))
}
