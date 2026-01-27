package biz

import (
	"context"
	"fmt"
	"net/http"

	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/models"
	notifyRequest "github.com/FrancisLv/PowerWeChat/v3/src/payment/notify/request"

	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// StringToUUID 将 32 个字符的字符串（无连字符）转换回uuid格式的字符串
func StringToUUID(uuidStr string) (string, error) {
	// 检查字符串长度是否为32
	if len(uuidStr) != 32 {
		return "", fmt.Errorf("invalid UUID string length: %d, expected 32", len(uuidStr))
	}

	// 在标准位置插入连字符，构建标准UUID格式字符串
	// 标准格式为：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	stdUUIDStr := uuidStr[0:8] + "-" + uuidStr[8:12] + "-" + uuidStr[12:16] + "-" + uuidStr[16:20] + "-" + uuidStr[20:32]

	return stdUUIDStr, nil
}

// WechatPayPaidNotify 支付-支付回调通知
func (w *WechatV1OrderUseCase) WechatPayPaidNotify(wr http.ResponseWriter, r *http.Request) {
	w.wechatPayRepo.WechatPayPaidNotify(wr, r, func(message *notifyRequest.RequestNotify, transaction *models.Transaction, fail func(message string)) interface{} {
		// 这里处理支付成功的业务逻辑
		w.log.Infof("WechatPayPaidNotify: outTradeNo=%s, transactionId=%s, tradeState=%s",
			transaction.OutTradeNo, transaction.TransactionID, transaction.TradeState)

		ctx := context.Background()
		orderId, err := StringToUUID(transaction.OutTradeNo)
		if err != nil {
			w.log.Errorf("WechatPayPaidNotify: invalid orderId=%s", transaction.OutTradeNo)
			fail("invalid orderId")
			return false
		}
		orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, orderId)
		oldOrderInfo := w.orderRepo.DeepCopy(orderInfo)
		if err != nil {
			w.log.Errorf("WechatPayPaidNotify: find order failed, orderId=%s, err=%s", orderId, err.Error())
			fail("find order failed")
			return false
		}
		// 如果订单状态不是待支付，则不处理
		if orderInfo.Status != string(constant.OrderStatusPendingPayment) {
			w.log.Warnf("WechatPayPaidNotify: order status is not pending payment, orderId=%s, status=%s", orderId, orderInfo.Status)
			return true
		}
		// 支付成功
		if transaction.TradeState == models.WX_TRADE_STATE_SUCCESS {
			// 支付成功后，订单状态变更为待预约，并记录支付时间和支付单号
			orderInfo.Status = string(constant.OrderStatusPending)
			orderInfo.ServiceStatus = string(constant.OrderStatusPending)
			paymentTime := timeutil.Carbon().Parse(transaction.SuccessTime).ToStdTime()
			orderInfo.PaymentTime = paymentTime
			orderInfo.PayID = transaction.TransactionID
			// 小程序渠道的实收金额等于订单金额
			orderInfo.ReceiptAmount = int32(orderInfo.OrderPrice*100 + 0.5) // 元转分，四舍五入
			// 更新订单信息
			err = w.orderRepo.UpdateOneCache(ctx, orderInfo, oldOrderInfo)
			if err != nil {
				w.log.Errorf("WechatPayPaidNotify: update order failed, orderId=%s, err=%s", orderId, err.Error())
				fail("update order failed")
				return false
			}

			// 拆分订单为子订单
			err = w.SplitOrderToSubOrders(ctx, orderId)
			if err != nil {
				w.log.Errorf("WechatPayPaidNotify: split order failed, orderId=%s, err=%s", orderId, err.Error())
				// 拆单失败不影响主流程，只记录日志
			}
		}

		// 如果订单已关闭、已撤销或支付失败，更新订单状态为交易关闭
		if transaction.TradeState == models.WX_TRADE_STATE_PAYERROR ||
			transaction.TradeState == models.WX_TRADE_STATE_CLOSED ||
			transaction.TradeState == models.WX_TRADE_STATE_REVOKED {
			orderInfo.Status = string(constant.OrderStatusClosed)

			err = w.orderRepo.UpdateOneCache(ctx, orderInfo, oldOrderInfo)
			if err != nil {
				w.log.Errorf("更新订单状态失败，订单ID：%s，错误：%v", orderInfo.ID, err)
				fail("update order failed")
				return false
			}

			// 如果使用了优惠券，需要解锁
			if orderInfo.UserCouponID != "" {
				userCoupon, err := w.userCouponRepo.FindOneCacheByID(ctx, orderInfo.UserCouponID)
				if err == nil && userCoupon != nil {
					oldUserCoupon := w.userCouponRepo.DeepCopy(userCoupon)
					userCoupon.Status = string(constant.UserCouponStatusUnUsed)
					w.userCouponRepo.UpdateOneCache(ctx, userCoupon, oldUserCoupon)
				}
			}
		}

		// 如果支付成功，发送模版消息
		if transaction.TradeState == models.WX_TRADE_STATE_SUCCESS {
			offiaccountOpenID, _ := w.GetOffiaccountOpenIdByPh(ctx, orderInfo.Ph)
			goodInfo, _ := w.goodRepo.FindOneCacheByID(ctx, orderInfo.GoodID)
			orderNumber := UUIDTo32String(orderInfo.OrderNumber)
			paymentTime := timeutil.Carbon().Parse(transaction.SuccessTime).ToStdTime().Format("2006-01-02 15:04:05")
			actualPrice := fmt.Sprintf("%.2f", float64(orderInfo.OrderPrice))
			if offiaccountOpenID != "" {
				w.userMessageRepo.SendOfficialOrderPaySuccessNotice(ctx, offiaccountOpenID, orderInfo.ID, orderNumber, goodInfo.Name, actualPrice, paymentTime)
			}
			// 发送飞书通知
			go func() {
				phone, _ := cryptutil.YcPhoneDecrypt(orderInfo.Ph)
				err := w.orderRepo.MiniProgramPayOrderNotify(context.Background(), paymentTime, goodInfo.Name, actualPrice, phone)
				if err != nil {
					w.log.Errorf("发送小程序支付成功飞书通知失败：%v", err)
				}
			}()
		}

		// 如果处理失败，调用 fail("失败原因") 返回失败信息给微信
		// 如果处理成功，返回 true
		return true
	})
}
