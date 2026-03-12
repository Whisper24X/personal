package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1CouponService(
	logger log.Logger,
	wechatV1CouponUseCase *biz.WechatV1CouponUseCase,
) *WechatV1CouponService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1Coupon"), log.WithMessageKey("message"))
	return &WechatV1CouponService{
		log:                   l,
		wechatV1CouponUseCase: wechatV1CouponUseCase,
	}
}

type WechatV1CouponService struct {
	pb.UnimplementedCouponServer
	log                   *log.Helper
	wechatV1CouponUseCase *biz.WechatV1CouponUseCase
}

// GetCouponList 优惠券表-列表数据查询
func (w *WechatV1CouponService) GetCouponList(ctx context.Context, req *pb.GetCouponListReq) (*pb.GetCouponListReply, error) {
	return w.wechatV1CouponUseCase.GetCouponList(ctx, req)
}

// GetCouponAdaptGoodInfoList 查询优惠券适用的商品信息
func (w *WechatV1CouponService) GetCouponAdaptGoodInfoList(ctx context.Context, req *pb.GetCouponAdaptGoodInfoListReq) (*pb.GetCouponAdaptGoodInfoListReply, error) {
	return w.wechatV1CouponUseCase.GetCouponAdaptGoodInfoList(ctx, req)
}

// GetCouponInfoById 查询优惠券信息
func (w *WechatV1CouponService) GetCouponInfoById(ctx context.Context, req *pb.GetCouponInfoByIdReq) (*pb.GetCouponInfoByIdReply, error) {
	return w.wechatV1CouponUseCase.GetCouponInfoById(ctx, req)
}
