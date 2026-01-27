package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1ChannelService(
	logger log.Logger,
	shadowV1ChannelUseCase *biz.ShadowV1ChannelUseCase,
) *ShadowV1ChannelService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Channel"), log.WithMessageKey("message"))
	return &ShadowV1ChannelService{
		log:                    l,
		shadowV1ChannelUseCase: shadowV1ChannelUseCase,
	}
}

type ShadowV1ChannelService struct {
	pb.UnimplementedChannelServer
	log                    *log.Helper
	shadowV1ChannelUseCase *biz.ShadowV1ChannelUseCase
}

// GetChannelList 渠道-列表数据查询
func (s *ShadowV1ChannelService) GetChannelList(ctx context.Context, req *pb.GetChannelListReq) (*pb.GetChannelListReply, error) {
	return s.shadowV1ChannelUseCase.GetChannelList(ctx, req)
}
