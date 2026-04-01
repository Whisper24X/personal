package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1ChannelUseCase(
	logger log.Logger,
	channelRepo ChannelRepo,
	dynamicFieldMappingRepo DynamicFieldMappingRepo,
) *ShadowV1ChannelUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Channel"), log.WithMessageKey("message"))
	return &ShadowV1ChannelUseCase{
		log:                     l,
		channelRepo:             channelRepo,
		dynamicFieldMappingRepo: dynamicFieldMappingRepo,
	}
}

type ShadowV1ChannelUseCase struct {
	log                     *log.Helper
	channelRepo             ChannelRepo
	dynamicFieldMappingRepo DynamicFieldMappingRepo
}
