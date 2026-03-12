package biz

import (
	"context"
	"fmt"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// CreateWechatPaymentOrder 订单-发起微信支付
func (w *WechatV1OrderUseCase) CreateWechatPaymentOrder(ctx context.Context, req *pb.CreateWechatPaymentOrderReq) (*pb.CreateWechatPaymentOrderReply, error) {
	resp := &pb.CreateWechatPaymentOrderReply{}
	// 获取用户ID
	userId := meta.GetUserID(ctx)
	userInfo, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if userInfo == nil || userInfo.ID == "" {
		return resp, errorx.UserNotExists.Err()
	}
	userWxInfo, err := w.userWxRepo.FindOneCacheByID(ctx, userInfo.UserWxID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if userWxInfo == nil || userWxInfo.ID == "" {
		return resp, errorx.UserNotExists.Err()
	}
	if userWxInfo.MiniprogramOpenID == "" {
		return resp, errorx.UserNotExists.Err()
	}
	// 查询订单
	orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if orderInfo == nil || orderInfo.ID == "" {
		return resp, errorx.OrderNotExists.Err()
	}
	// 查询商品名称
	channelGoodInfo, err := w.goodRepo.FindOneCacheByChannelGoodID(ctx, orderInfo.ChannelGoodID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	channelGoodName := ""
	if channelGoodInfo != nil && channelGoodInfo.Name != "" {
		channelGoodName = channelGoodInfo.Name
	}
	// 订单ID 32位字符串
	orderId32 := UUIDTo32String(req.GetOrderId())
	// 订单金额，单位为分
	amount := int(orderInfo.OrderPrice * 100)
	// 商品描述 必填，不能为空
	description := fmt.Sprintf("洋葱研学-%s", channelGoodName)
	// 测试环境支付，只需要付一分钱
	if w.cfg.GetEnv() == conf.GO_ENV_test && amount > 1000 {
		amount = 1
	}
	prePayId, err := w.wechatPayRepo.CreateWechatPayOrder(ctx, userWxInfo.MiniprogramOpenID, orderId32, amount, description)
	if err != nil {
		return resp, errorx.APIThirdErr.WithError(err).Err()
	}
	// 获取JSSDK配置
	jsSdkOptions, err := w.wechatPayRepo.GetWechatPayOrderJSSDKBridgeConfig(ctx, prePayId)
	if err != nil {
		w.log.Errorf("GetWechatPayOrderJSSDKBridgeConfig err: %v", err)
		return nil, errors.InternalServer("GET_JSSDK_CONFIG_FAILED", "获取JSSDK配置失败")
	}
	w.log.Infof("CreateWechatPaymentOrder orderId:%s, openId:%s, prePayId:%s", req.GetOrderId(), userWxInfo.MiniprogramOpenID, prePayId)
	resp.PrePayId = prePayId
	resp.JsSdkOptions = jsSdkOptions
	return resp, nil
}
