package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1UserWxService(
	logger log.Logger,
	shadowV1UserWxUseCase *biz.ShadowV1UserWxUseCase,
) *ShadowV1UserWxService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1UserWx"), log.WithMessageKey("message"))
	return &ShadowV1UserWxService{
		log:                   l,
		shadowV1UserWxUseCase: shadowV1UserWxUseCase,
	}
}

type ShadowV1UserWxService struct {
	pb.UnimplementedUserWxServer
	log                   *log.Helper
	shadowV1UserWxUseCase *biz.ShadowV1UserWxUseCase
}

// SyncUserWxUnionid 用户-微信-unionid同步
func (s *ShadowV1UserWxService) SyncUserWxUnionid(ctx context.Context, req *pb.SyncUserWxUnionidReq) (*pb.SyncUserWxUnionidReply, error) {
	return s.shadowV1UserWxUseCase.SyncUserWxUnionid(ctx, req)
}
