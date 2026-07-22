package biz

import "github.com/go-kratos/kratos/v2/log"

func NewDynamicDockConfigV1DynamicDockConfigUseCase(
	logger log.Logger,
) *DynamicDockConfigV1DynamicDockConfigUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/dynamicDockConfigV1DynamicDockConfig"), log.WithMessageKey("message"))
	return &DynamicDockConfigV1DynamicDockConfigUseCase{
		log: l,
	}
}

type DynamicDockConfigV1DynamicDockConfigUseCase struct {
	log *log.Helper
}
