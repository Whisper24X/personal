package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
)

// UpdateUserCoupon 用户优惠券记录表-更新一条数据
func (w *WechatV1UserCouponUseCase) UpdateUserCoupon(ctx context.Context, req *pb.UpdateUserCouponReq) (*pb.UpdateUserCouponReply, error) {
	resp := &pb.UpdateUserCouponReply{}
	return resp, nil
}
