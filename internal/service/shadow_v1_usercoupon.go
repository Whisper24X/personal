package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1UserCouponService(
	logger log.Logger,
	shadowV1UserCouponUseCase *biz.ShadowV1UserCouponUseCase,
) *ShadowV1UserCouponService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1UserCoupon"), log.WithMessageKey("message"))
	return &ShadowV1UserCouponService{
		log:                       l,
		shadowV1UserCouponUseCase: shadowV1UserCouponUseCase,
	}
}

type ShadowV1UserCouponService struct {
	pb.UnimplementedUserCouponServer
	log                       *log.Helper
	shadowV1UserCouponUseCase *biz.ShadowV1UserCouponUseCase
}

// GetUserCouponList 用户优惠券记录表-列表数据查询
func (s *ShadowV1UserCouponService) GetUserCouponList(ctx context.Context, req *pb.GetUserCouponListReq) (*pb.GetUserCouponListReply, error) {
	return s.shadowV1UserCouponUseCase.GetUserCouponList(ctx, req)
}

// ExpireUserCoupons 过期用户优惠券状态更新
func (s *ShadowV1UserCouponService) ExpireUserCoupons(ctx context.Context, req *pb.ExpireUserCouponsReq) (*pb.ExpireUserCouponsReply, error) {
	return s.shadowV1UserCouponUseCase.ExpireUserCoupons(ctx, req)
}
