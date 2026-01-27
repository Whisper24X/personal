package biz

import (
	"context"
	"sync"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// SyncWechatPayOrderStatus 同步微信支付订单状态
func (s *ShadowV1OrderUseCase) SyncWechatPayOrderStatus(ctx context.Context, req *pb.SyncWechatPayOrderStatusReq) (*pb.SyncWechatPayOrderStatusReply, error) {
	resp := &pb.SyncWechatPayOrderStatusReply{}

	// 使用分布式锁防止重复执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncWechatPayOrderStatusLock.Key(), cache.SyncWechatPayOrderStatusLock.TTL(), func() error {
		// 查询待支付和退款中的订单
		// 构建查询条件：状态为待支付或退款中的订单
		param := &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "status",
					Value: []string{string(constant.OrderStatusPendingPayment), string(constant.OrderStatusRefunding)},
					Exp:   condition.IN,
					Logic: condition.AND,
				},
			},
			Order: []*condition.OrderParam{
				{
					Field: "createdAt",
					Order: condition.ASC,
				},
			},
		}

		// 查询待支付和退款中的订单
		orderList, _, err := s.orderRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}

		// 如果没有需要处理的订单，直接返回
		if len(orderList) == 0 {
			s.log.Info("没有需要处理的微信支付订单")
			return nil
		}

		s.log.Infof("共找到 %d 个需要处理的微信支付订单", len(orderList))

		// 并发处理订单状态查询
		var wg sync.WaitGroup
		wg.Add(len(orderList))

		// 处理成功的订单数量
		successCount := 0
		var mu sync.Mutex // 用于保护successCount变量

		for _, order := range orderList {
			go func(order *yanxue_model.Order) {
				defer wg.Done()
				// 处理单个订单
				if s.processWechatPayOrder(context.Background(), order) {
					mu.Lock()
					successCount++
					mu.Unlock()
				}
			}(order)
		}

		// 等待所有goroutine完成
		wg.Wait()

		s.log.Infof("成功处理 %d 个微信支付订单", successCount)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// processWechatPayOrder 处理单个微信支付订单
func (s *ShadowV1OrderUseCase) processWechatPayOrder(ctx context.Context, order *yanxue_model.Order) bool {
	// 根据订单状态调用不同的微信支付查询接口
	if order.Status == string(constant.OrderStatusPendingPayment) {
		// 查询支付状态
		return s.queryWechatPayOrderStatus(ctx, order)
	} else if order.Status == string(constant.OrderStatusRefunding) {
		// 查询退款状态
		return s.queryWechatRefundStatus(ctx, order)
	}
	return false
}

// queryWechatPayOrderStatus 查询微信支付订单状态
func (s *ShadowV1OrderUseCase) queryWechatPayOrderStatus(ctx context.Context, order *yanxue_model.Order) bool {
	// 调用微信支付订单查询接口
	// 使用商户订单号（outTradeNo）查询
	orderId := UUIDTo32String(order.ID)
	orderInfo, err := s.wechatPayRepo.GetWechatPayOrderInfoByOutTradeNo(ctx, orderId)
	if err != nil {
		s.log.Errorf("查询微信支付订单失败，订单ID：%s，错误：%v", orderId, err)
		return false
	}

	newOrder, err := s.orderRepo.FindOneCacheByID(ctx, order.ID)
	if err != nil {
		s.log.Errorf("查询订单失败，订单ID：%s，错误：%v", order.ID, err)
		return false
	}
	// 订单状态不是待支付，则不需要处理
	if newOrder.Status != string(constant.OrderStatusPendingPayment) {
		s.log.Warnf("订单状态已改变，订单ID：%s，当前状态：%s", order.ID, newOrder.Status)
		return false
	}

	// 根据微信返回的交易状态更新订单状态
	// SUCCESS：支付成功
	// REFUND：转入退款
	// NOTPAY：未支付
	// CLOSED：已关闭
	// REVOKED：已撤销（付款码支付）
	// USERPAYING：用户支付中（付款码支付）
	// PAYERROR：支付失败(其他原因，如银行返回失败)

	// 如果支付成功，更新订单状态
	if orderInfo.TradeState == "SUCCESS" {
		// 更新订单状态为支付完成，服务状态为待预约
		oldOrder := s.orderRepo.DeepCopy(newOrder)
		newOrder.Status = string(constant.OrderStatusPending)
		newOrder.ServiceStatus = string(constant.OrderStatusPending)
		newOrder.PaymentTime = timeutil.Carbon().Parse(orderInfo.SuccessTime).ToStdTime()
		newOrder.PayID = orderInfo.TransactionID
		// 小程序渠道的实收金额等于订单金额
		newOrder.ReceiptAmount = int32(newOrder.OrderPrice*100 + 0.5) // 元转分，四舍五入

		err = s.orderRepo.UpdateOneCache(ctx, newOrder, oldOrder)
		if err != nil {
			s.log.Errorf("更新订单状态失败，订单ID：%s，错误：%v", newOrder.ID, err)
			return false
		}

		s.log.Infof("订单支付成功，订单ID：%s", newOrder.ID)

		// 拆分订单为子订单
		err = s.SplitOrderToSubOrders(ctx, newOrder.ID)
		if err != nil {
			s.log.Errorf("WechatPayPaidNotify: split order failed, orderId=%s, err=%s", orderId, err.Error())
			// 拆单失败不影响主流程，只记录日志
		}
		return true
	} else if orderInfo.TradeState == "REFUND" {
		s.log.Infof("订单转入退款，订单ID：%s", newOrder.ID)
		return true
	} else if orderInfo.TradeState == "CLOSED" || orderInfo.TradeState == "REVOKED" || orderInfo.TradeState == "PAYERROR" {
		// 如果订单已关闭、已撤销或支付失败，更新订单状态为交易关闭
		oldOrder := s.orderRepo.DeepCopy(newOrder)
		newOrder.Status = string(constant.OrderStatusClosed)

		err = s.orderRepo.UpdateOneCache(ctx, newOrder, oldOrder)
		if err != nil {
			s.log.Errorf("更新订单状态失败，订单ID：%s，错误：%v", newOrder.ID, err)
			return false
		}

		// 如果使用了优惠券，需要解锁
		if newOrder.UserCouponID != "" {
			userCoupon, err := s.userCouponRepo.FindOneCacheByID(ctx, newOrder.UserCouponID)
			if err == nil && userCoupon != nil {
				oldUserCoupon := s.userCouponRepo.DeepCopy(userCoupon)
				userCoupon.Status = string(constant.UserCouponStatusUnUsed)
				s.userCouponRepo.UpdateOneCache(ctx, userCoupon, oldUserCoupon)
			}
		}

		s.log.Infof("订单关闭或支付失败，订单ID：%s", newOrder.ID)
		return true
	}

	// 其他状态不需要处理
	return false
}

// queryWechatRefundStatus 查询微信退款状态
func (s *ShadowV1OrderUseCase) queryWechatRefundStatus(ctx context.Context, order *yanxue_model.Order) bool {
	// 如果订单没有退款ID，无法查询退款状态
	if order.RefundID == "" {
		s.log.Warnf("订单没有退款ID，无法查询退款状态，订单ID：%s", order.ID)
		return false
	}

	// 调用微信退款查询接口
	refundInfo, err := s.wechatPayRepo.WechatPayRefundQuery(ctx, order.RefundID)
	if err != nil {
		s.log.Errorf("查询微信退款状态失败，订单ID：%s，退款ID：%s，错误：%v", order.ID, order.RefundID, err)
		return false
	}

	newOrder, err := s.orderRepo.FindOneCacheByID(ctx, order.ID)
	if err != nil {
		s.log.Errorf("查询订单失败，订单ID：%s，错误：%v", order.ID, err)
		return false
	}
	// 如果订单状态不是退款中，则不用处理
	if newOrder.Status != string(constant.OrderStatusRefunding) {
		s.log.Warnf("订单状态已改变，订单ID：%s，当前状态：%s", order.ID, newOrder.Status)
		return false
	}

	// 根据微信返回的退款状态更新订单状态
	// SUCCESS：退款成功
	// CLOSED：退款关闭
	// PROCESSING：退款处理中
	// ABNORMAL：退款异常

	var newStatus string
	switch refundInfo.Status {
	case "SUCCESS":
		// 退款成功
		newStatus = string(constant.OrderStatusRefunded)
	case "CLOSED":
		// 退款关闭，维持原状态或根据业务需要处理
		// 这里我们维持退款中状态，等待进一步处理
		return false
	case "PROCESSING":
		// 退款处理中，维持原状态
		return false
	case "ABNORMAL":
		// 退款异常，更新为退款失败状态
		newStatus = string(constant.OrderStatusFailedRefund)
		// 退款失败需要发送飞书通知
		s.orderRepo.OrderRefundFailedFeiShuNotify(ctx, newOrder.OrderNumber, constant.ChannelTypeXCX)
	default:
		// 其他状态不处理
		return false
	}

	// 更新订单状态
	oldOrder := s.orderRepo.DeepCopy(newOrder)
	newOrder.Status = newStatus

	err = s.orderRepo.UpdateOneCache(ctx, newOrder, oldOrder)
	if err != nil {
		s.log.Errorf("更新订单状态失败，订单ID：%s，错误：%v", newOrder.ID, err)
		return false
	}

	s.log.Infof("订单退款状态更新，订单ID：%s，新状态：%s", newOrder.ID, newStatus)

	// 如果退款成功，分配退款金额到子订单
	if newStatus == string(constant.OrderStatusRefunded) {
		err = DistributeRefundToSubOrders(
			ctx,
			newOrder.ID,
			newOrder.RefundAmount,
			newOrder.RefundID,
			newOrder.RefundReason,
			newOrder.RefundTime,
			s.subOrderRepo,
			s.log,
		)
		if err != nil {
			s.log.Errorf("分配退款金额到子订单失败，orderId=%s, err=%v", newOrder.ID, err)
			// 不中断主流程，继续执行
		}
	}

	return true
}
