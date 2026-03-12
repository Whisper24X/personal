package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1PlatformGoodService(
	logger log.Logger,
	shadowV1PlatformGoodUseCase *biz.ShadowV1PlatformGoodUseCase,
) *ShadowV1PlatformGoodService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1PlatformGood"), log.WithMessageKey("message"))
	return &ShadowV1PlatformGoodService{
		log:                         l,
		shadowV1PlatformGoodUseCase: shadowV1PlatformGoodUseCase,
	}
}

type ShadowV1PlatformGoodService struct {
	pb.UnimplementedPlatformGoodServer
	log                         *log.Helper
	shadowV1PlatformGoodUseCase *biz.ShadowV1PlatformGoodUseCase
}

// CreatePlatformGood 平台商品-创建一条数据
func (s *ShadowV1PlatformGoodService) CreatePlatformGood(ctx context.Context, req *pb.CreatePlatformGoodReq) (*pb.CreatePlatformGoodReply, error) {
	return s.shadowV1PlatformGoodUseCase.CreatePlatformGood(ctx, req)
}

// GetPlatformGoodList 平台商品-列表数据查询
func (s *ShadowV1PlatformGoodService) GetPlatformGoodList(ctx context.Context, req *pb.GetPlatformGoodListReq) (*pb.GetPlatformGoodListReply, error) {
	return s.shadowV1PlatformGoodUseCase.GetPlatformGoodList(ctx, req)
}

// UpdatePlatformGood 平台商品-更新一条数据
func (s *ShadowV1PlatformGoodService) UpdatePlatformGood(ctx context.Context, req *pb.UpdatePlatformGoodReq) (*pb.UpdatePlatformGoodReply, error) {
	return s.shadowV1PlatformGoodUseCase.UpdatePlatformGood(ctx, req)
}
