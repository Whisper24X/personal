package biz

import (
	"context"
	"fmt"
	"net/http"

	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/models"
	notifyRequest "github.com/FrancisLv/PowerWeChat/v3/src/payment/notify/request"

	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

func (w *WechatV1OrderUseCase) GetOffiaccountOpenIdByPh(ctx context.Context, ph string) (string, error) {
	userInfo, err := w.userRepo.FindOneByPh(ctx, ph)
	if err != nil {
		return "", errorx.DataSQLErr.WithError(err).Err()
	}
	if userInfo == nil {
		return "", nil
	}
	userWxId := userInfo.UserWxID
	userWxInfo, err := w.userWxRepo.FindOneCacheByID(ctx, userWxId)
	if err != nil {
		return "", errorx.DataSQLErr.WithError(err).Err()
	}
	if userWxInfo == nil {
		return "", nil
	}
	return userWxInfo.OffiaccountOpenID, nil
}

// WechatPayRefundNotify 支付-退款回调通知
func (w *WechatV1OrderUseCase) WechatPayRefundNotify(wr http.ResponseWriter, r *http.Request) {
	w.wechatPayRepo.WechatPayRefundNotify(wr, r, func(message *notifyRequest.RequestNotify, refund *models.Refund, fail func(message string)) interface{} {
		// 这里处理退款成功的业务逻辑
		w.log.Infof("WechatPayRefundNotify: outTradeNo=%s, outRefundNo=%s, refundStatus=%s",
			refund.OutTradeNo, refund.OutRefundNo, refund.RefundStatus)

		orderId, err := StringToUUID(refund.OutTradeNo)
		if err != nil {
			w.log.Errorf("订单格式错误,转换成uuid失败！订单ID：%s", refund.OutTradeNo)
			fail("订单号格式错误")
			return false
		}
		ctx := context.Background()
		orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, orderId)
		if err != nil {
			w.log.Errorf("订单不存在,订单ID：%s", orderId)
			fail("订单不存在")
			return false
		}
		offiaccountOpenID, _ := w.GetOffiaccountOpenIdByPh(ctx, orderInfo.Ph)
		// 接收到回调之后，修改订单状态
		// SUCCESS：退款成功；CLOSED：退款关闭；PROCESSING：退款处理中；ABNORMAL：退款异常
		orderStatus := ""
		if refund.RefundStatus == "SUCCESS" { // 退款成功
			orderStatus = string(constant.OrderStatusRefunded)
		} else if refund.RefundStatus == "CLOSED" || refund.RefundStatus == "PROCESSING" { // 退款关闭
			// 维持原先状态
			orderStatus = orderInfo.Status
		} else if refund.RefundStatus == "ABNORMAL" { // 退款异常
			orderStatus = string(constant.OrderStatusFailedRefund)
			// 退款异常需要发送飞书通知
			w.orderRepo.OrderRefundFailedFeiShuNotify(ctx, orderInfo.OrderNumber, constant.ChannelTypeXCX)
		}
		oldOrderInfo := w.orderRepo.DeepCopy(orderInfo)
		orderInfo.Status = orderStatus
		if refund.Amount != nil {
			orderInfo.RefundAmount = int32(refund.Amount.Refund)
		}
		if refund.SuccessTime != nil {
			orderInfo.RefundTime = *refund.SuccessTime
		}
		err = w.orderRepo.UpdateOneCache(ctx, orderInfo, oldOrderInfo)
		if err != nil {
			w.log.Errorf("更新订单状态失败,订单ID：%s", orderId)
			fail("更新订单状态失败")
			return false
		}

		// 如果退款成功，分配退款金额到子订单
		if orderStatus == string(constant.OrderStatusRefunded) {
			err = DistributeRefundToSubOrders(
				ctx,
				orderInfo.ID,
				orderInfo.RefundAmount,
				orderInfo.RefundID,
				orderInfo.RefundReason,
				orderInfo.RefundTime,
				w.subOrderRepo,
				w.log,
			)
			if err != nil {
				w.log.Errorf("分配退款金额到子订单失败，orderId=%s, err=%v", orderInfo.ID, err)
				// 不中断主流程，继续执行
			}
		}

		// 如果退款成功，需要发送公众号模版消息，发送飞书通知
		if orderStatus == string(constant.OrderStatusRefunded) {
			// 发送公众号模版消息
			goodInfo, _ := w.goodRepo.FindOneCacheByID(ctx, orderInfo.GoodID)
			orderNumber := UUIDTo32String(orderInfo.OrderNumber)
			if goodInfo.ID != "" {
				w.userMessageRepo.SendOfficialOrderRefundSuccessNotice(ctx, offiaccountOpenID, orderInfo.ID, orderNumber, goodInfo.Name, fmt.Sprintf("%.2f", float64(orderInfo.RefundAmount)/100.0))
			}
		}
		return true
	})
}
