package rpc

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-resty/resty/v2"
)

func NewHttpRpc(logger log.Logger, restyClient *resty.Client) *HttpRpc {
	l := log.NewHelper(log.With(logger, "module", "data/rpc"), log.WithMessageKey("message"))
	return &HttpRpc{
		log:         l,
		restyClient: restyClient,
	}
}

type HttpRpc struct {
	log         *log.Helper
	restyClient *resty.Client
}
