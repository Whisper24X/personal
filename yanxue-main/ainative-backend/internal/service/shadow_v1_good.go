package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1GoodService(
	logger log.Logger,
	shadowV1GoodUseCase *biz.ShadowV1GoodUseCase,
) *ShadowV1GoodService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Good"), log.WithMessageKey("message"))
	return &ShadowV1GoodService{
		log:                 l,
		shadowV1GoodUseCase: shadowV1GoodUseCase,
	}
}

type ShadowV1GoodService struct {
	pb.UnimplementedGoodServer
	log                 *log.Helper
	shadowV1GoodUseCase *biz.ShadowV1GoodUseCase
}

// CreateGood 商品-创建一条数据
func (s *ShadowV1GoodService) CreateGood(ctx context.Context, req *pb.CreateGoodReq) (*pb.CreateGoodReply, error) {
	return s.shadowV1GoodUseCase.CreateGood(ctx, req)
}

// UpdateGood 商品-更新一条数据
func (s *ShadowV1GoodService) UpdateGood(ctx context.Context, req *pb.UpdateGoodReq) (*pb.UpdateGoodReply, error) {
	return s.shadowV1GoodUseCase.UpdateGood(ctx, req)
}

// UpdateGoodStatus 商品-修改商品状态
func (s *ShadowV1GoodService) UpdateGoodStatus(ctx context.Context, req *pb.UpdateGoodStatusReq) (*pb.UpdateGoodStatusReply, error) {
	return s.shadowV1GoodUseCase.UpdateGoodStatus(ctx, req)
}

// GetGoodInfo 商品-单条数据查询
func (s *ShadowV1GoodService) GetGoodInfo(ctx context.Context, req *pb.GetGoodInfoReq) (*pb.GetGoodInfoReply, error) {
	return s.shadowV1GoodUseCase.GetGoodInfo(ctx, req)
}

// GetGoodList 商品-列表数据查询
func (s *ShadowV1GoodService) GetGoodList(ctx context.Context, req *pb.GetGoodListReq) (*pb.GetGoodListReply, error) {
	return s.shadowV1GoodUseCase.GetGoodList(ctx, req)
}
