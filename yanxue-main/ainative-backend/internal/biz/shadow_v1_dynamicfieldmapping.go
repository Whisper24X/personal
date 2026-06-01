package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1DynamicFieldMappingUseCase(
	logger log.Logger,
	dynamicFieldMappingRepo DynamicFieldMappingRepo,
) *ShadowV1DynamicFieldMappingUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1DynamicFieldMapping"), log.WithMessageKey("message"))
	return &ShadowV1DynamicFieldMappingUseCase{
		log:                     l,
		dynamicFieldMappingRepo: dynamicFieldMappingRepo,
	}
}

type ShadowV1DynamicFieldMappingUseCase struct {
	log                     *log.Helper
	dynamicFieldMappingRepo DynamicFieldMappingRepo
}
