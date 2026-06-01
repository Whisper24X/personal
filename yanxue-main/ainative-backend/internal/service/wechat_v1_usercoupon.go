package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1UserCouponService(
	logger log.Logger,
	wechatV1UserCouponUseCase *biz.WechatV1UserCouponUseCase,
) *WechatV1UserCouponService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1UserCoupon"), log.WithMessageKey("message"))
	return &WechatV1UserCouponService{
		log:                       l,
		wechatV1UserCouponUseCase: wechatV1UserCouponUseCase,
	}
}

type WechatV1UserCouponService struct {
	pb.UnimplementedUserCouponServer
	log                       *log.Helper
	wechatV1UserCouponUseCase *biz.WechatV1UserCouponUseCase
}

// CreateUserCoupon 用户优惠券记录表-创建一条数据
func (w *WechatV1UserCouponService) CreateUserCoupon(ctx context.Context, req *pb.CreateUserCouponReq) (*pb.CreateUserCouponReply, error) {
	return w.wechatV1UserCouponUseCase.CreateUserCoupon(ctx, req)
}

// UpdateUserCoupon 用户优惠券记录表-更新一条数据
func (w *WechatV1UserCouponService) UpdateUserCoupon(ctx context.Context, req *pb.UpdateUserCouponReq) (*pb.UpdateUserCouponReply, error) {
	return w.wechatV1UserCouponUseCase.UpdateUserCoupon(ctx, req)
}

// GetMyCouponList 用户优惠券记录表-查询我的优惠券列表
func (w *WechatV1UserCouponService) GetMyCouponList(ctx context.Context, req *pb.GetMyCouponListReq) (*pb.GetMyCouponListReply, error) {
	return w.wechatV1UserCouponUseCase.GetMyCouponList(ctx, req)
}

// GetUserCouponInfo 用户优惠券记录表-通过用户优惠券ID查询用户优惠券信息
func (w *WechatV1UserCouponService) GetUserCouponInfo(ctx context.Context, req *pb.GetUserCouponInfoReq) (*pb.GetUserCouponInfoReply, error) {
	return w.wechatV1UserCouponUseCase.GetUserCouponInfo(ctx, req)
}
