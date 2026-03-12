package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// FinishOrder 订单-结束
func (s *ShadowV1OrderUseCase) FinishOrder(ctx context.Context, req *pb.FinishOrderReq) (*pb.FinishOrderReply, error) {
	resp := &pb.FinishOrderReply{}
	for _, orderId := range req.OrderIds {
		err := s.bffRepo.FinishOrderItem(ctx, orderId)
		if err != nil {
			return nil, err
		}
	}
	return resp, nil
}
