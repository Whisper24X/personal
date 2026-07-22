package biz

import "github.com/go-kratos/kratos/v2/log"

func NewDynamicLearnConfigV1DynamicLearnConfigUseCase(
	logger log.Logger,
) *DynamicLearnConfigV1DynamicLearnConfigUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/dynamicLearnConfigV1DynamicLearnConfig"), log.WithMessageKey("message"))
	return &DynamicLearnConfigV1DynamicLearnConfigUseCase{
		log: l,
	}
}

type DynamicLearnConfigV1DynamicLearnConfigUseCase struct {
	log *log.Helper
}
