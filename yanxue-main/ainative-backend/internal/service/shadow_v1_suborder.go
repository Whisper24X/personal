package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SubOrderService(
	logger log.Logger,
	shadowV1SubOrderUseCase *biz.ShadowV1SubOrderUseCase,
) *ShadowV1SubOrderService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SubOrder"), log.WithMessageKey("message"))
	return &ShadowV1SubOrderService{
		log:                     l,
		shadowV1SubOrderUseCase: shadowV1SubOrderUseCase,
	}
}

type ShadowV1SubOrderService struct {
	pb.UnimplementedSubOrderServer
	log                     *log.Helper
	shadowV1SubOrderUseCase *biz.ShadowV1SubOrderUseCase
}

// GetSubOrderList 子订单-列表数据查询
func (s *ShadowV1SubOrderService) GetSubOrderList(ctx context.Context, req *pb.GetSubOrderListReq) (*pb.GetSubOrderListReply, error) {
	return s.shadowV1SubOrderUseCase.GetSubOrderList(ctx, req)
}

// ExportSubOrderList 订单-导出子订单信息
func (s *ShadowV1SubOrderService) ExportSubOrderList(ctx context.Context, req *pb.ExportSubOrderListReq) (*pb.ExportSubOrderListReply, error) {
	return s.shadowV1SubOrderUseCase.ExportSubOrderList(ctx, req)
}
