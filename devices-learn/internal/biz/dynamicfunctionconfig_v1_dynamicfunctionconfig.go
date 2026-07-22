package biz

import "github.com/go-kratos/kratos/v2/log"

func NewDynamicFunctionConfigV1DynamicFunctionConfigUseCase(
	logger log.Logger,
) *DynamicFunctionConfigV1DynamicFunctionConfigUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/dynamicFunctionConfigV1DynamicFunctionConfig"), log.WithMessageKey("message"))
	return &DynamicFunctionConfigV1DynamicFunctionConfigUseCase{
		log: l,
	}
}

type DynamicFunctionConfigV1DynamicFunctionConfigUseCase struct {
	log *log.Helper
}
