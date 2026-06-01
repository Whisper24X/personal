package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1CouponService(
	logger log.Logger,
	shadowV1CouponUseCase *biz.ShadowV1CouponUseCase,
) *ShadowV1CouponService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Coupon"), log.WithMessageKey("message"))
	return &ShadowV1CouponService{
		log:                   l,
		shadowV1CouponUseCase: shadowV1CouponUseCase,
	}
}

type ShadowV1CouponService struct {
	pb.UnimplementedCouponServer
	log                   *log.Helper
	shadowV1CouponUseCase *biz.ShadowV1CouponUseCase
}

// CreateCoupon 优惠券表-创建一条数据
func (s *ShadowV1CouponService) CreateCoupon(ctx context.Context, req *pb.CreateCouponReq) (*pb.CreateCouponReply, error) {
	return s.shadowV1CouponUseCase.CreateCoupon(ctx, req)
}

// GetCouponInfo 优惠券表-单条数据查询
func (s *ShadowV1CouponService) GetCouponInfo(ctx context.Context, req *pb.GetCouponInfoReq) (*pb.GetCouponInfoReply, error) {
	return s.shadowV1CouponUseCase.GetCouponInfo(ctx, req)
}

// GetCouponList 优惠券表-列表数据查询
func (s *ShadowV1CouponService) GetCouponList(ctx context.Context, req *pb.GetCouponListReq) (*pb.GetCouponListReply, error) {
	return s.shadowV1CouponUseCase.GetCouponList(ctx, req)
}

// UpdateCouponStatus 优惠券表-更新优惠券状态
func (s *ShadowV1CouponService) UpdateCouponStatus(ctx context.Context, req *pb.UpdateCouponStatusReq) (*pb.UpdateCouponStatusReply, error) {
	return s.shadowV1CouponUseCase.UpdateCouponStatus(ctx, req)
}

// GetCouponQuantitySummary 优惠券表-查询优惠券数量信息
func (s *ShadowV1CouponService) GetCouponQuantitySummary(ctx context.Context, req *pb.GetCouponQuantitySummaryReq) (*pb.GetCouponQuantitySummaryReply, error) {
	return s.shadowV1CouponUseCase.GetCouponQuantitySummary(ctx, req)
}
