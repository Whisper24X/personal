package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// CancelOrder 订单-取消
func (s *ShadowV1OrderUseCase) CancelOrder(ctx context.Context, req *pb.CancelOrderReq) (*pb.CancelOrderReply, error) {
	resp := &pb.CancelOrderReply{}
	for _, orderId := range req.OrderIds {
		err := s.bffRepo.CancelOrder(ctx, orderId)
		if err != nil {
			return nil, err
		}
	}
	return resp, nil
}
