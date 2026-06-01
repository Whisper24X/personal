package biz

import (
	"context"
	"sync"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// OrderItem 抖音订单信息项
type OrderItem struct {
	Certificate []struct {
		CertificateId  string `json:"certificate_id"`
		CombinationId  string `json:"combination_id"`
		ItemStatus     int    `json:"item_status"`
		ItemUpdateTime int    `json:"item_update_time"`
		OrderItemId    string `json:"order_item_id"`
		RefundAmount   int    `json:"refund_amount"`
		RefundTime     int    `json:"refund_time"`
	}
	OrderStatus    int32
	SkuName        string
	SkuId          string
	OrderId        string
	OrderType      int32
	Count          int32
	ReceiptAmount  int32
	DiscountAmount int32
	AnchorId       int64
	PayTime        int64
	PayAmount      int
}

// SyncDouYinOrder 同步抖音订单
// 功能：查询抖音渠道的所有订单数据，检查数据库中是否存在，如果不存在则新增
func (s *ShadowV1OrderUseCase) SyncDouYinOrder(ctx context.Context, req *pb.SyncDouYinOrderReq) (*pb.SyncDouYinOrderReply, error) {
	resp := &pb.SyncDouYinOrderReply{}

	// 使用分布式锁，防止并发执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncDouYinOrderLock.Key(), cache.SyncDouYinOrderLock.TTL(), func() error {
		// 异步执行，避免阻塞接口响应
		go func() {
			s.syncDouYinOrderAsync()
		}()
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// syncDouYinOrderAsync 异步同步抖音订单
func (s *ShadowV1OrderUseCase) syncDouYinOrderAsync() {
	ctx := context.Background()

	s.log.Infof("SyncDouYinOrder: 开始同步抖音订单")

	// 1. 分页查询抖音所有订单
	const pageSize = 100
	var allOrders []OrderItem

	// 查询第一页
	reply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
		AccountId: constant.DouYinAccountId,
		PageNum:   1,
		PageSize:  pageSize,
	})
	if err != nil {
		s.log.Errorf("SyncDouYinOrder: 获取抖音订单第1页失败：%v", err)
		return
	}
	if reply == nil {
		s.log.Error("SyncDouYinOrder: 获取抖音订单返回数据为空")
		return
	}

	total := reply.Data.Page.Total
	totalPages := (total + pageSize - 1) / pageSize // 向上取整
	s.log.Infof("SyncDouYinOrder: 抖音订单总数：%d，总页数：%d", total, totalPages)

	// 添加第一页数据
	for _, order := range reply.Data.Orders {
		allOrders = append(allOrders, OrderItem{
			Certificate:    order.Certificate,
			OrderStatus:    order.OrderStatus,
			SkuName:        order.SkuName,
			SkuId:          order.SkuId,
			OrderId:        order.OrderId,
			OrderType:      order.OrderType,
			Count:          order.Count,
			ReceiptAmount:  order.ReceiptAmount,
			DiscountAmount: order.DiscountAmount,
			AnchorId:       order.AnchorId,
		})
	}

	// 查询剩余页
	for pageNum := 2; pageNum <= totalPages; pageNum++ {
		pageReply, pageErr := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
			AccountId: constant.DouYinAccountId,
			PageNum:   pageNum,
			PageSize:  pageSize,
		})
		if pageErr != nil {
			s.log.Errorf("SyncDouYinOrder: 获取抖音订单第%d页失败：%v", pageNum, pageErr)
			continue
		}
		if pageReply == nil {
			s.log.Errorf("SyncDouYinOrder: 获取抖音订单第%d页返回数据为空", pageNum)
			continue
		}

		for _, order := range pageReply.Data.Orders {
			allOrders = append(allOrders, OrderItem{
				Certificate:    order.Certificate,
				OrderStatus:    order.OrderStatus,
				SkuName:        order.SkuName,
				SkuId:          order.SkuId,
				OrderId:        order.OrderId,
				OrderType:      order.OrderType,
				Count:          order.Count,
				ReceiptAmount:  order.ReceiptAmount,
				DiscountAmount: order.DiscountAmount,
				AnchorId:       order.AnchorId,
			})
		}
		s.log.Infof("SyncDouYinOrder: 已获取抖音订单数据：%d/%d", len(allOrders), total)
	}

	s.log.Infof("SyncDouYinOrder: 抖音订单数据获取完成，共获取%d条记录", len(allOrders))

	// 2. 过滤出支付成功的订单
	var paidOrders []OrderItem
	for _, order := range allOrders {
		// 只处理支付成功、待使用、部分支付的订单
		if order.OrderStatus == constant.OrderStatusPaySuccess ||
			order.OrderStatus == constant.OrderStatusAvailable ||
			order.OrderStatus == constant.OrderStatusPartPay {
			paidOrders = append(paidOrders, order)
		}
	}

	s.log.Infof("SyncDouYinOrder: 过滤出支付成功的订单，共%d条", len(paidOrders))

	if len(paidOrders) == 0 {
		s.log.Infof("SyncDouYinOrder: 没有需要同步的订单")
		return
	}

	// 3. 并发处理每个订单
	var wg sync.WaitGroup
	var mu sync.Mutex
	var successCount int
	var failCount int

	// 使用信号量控制并发数，避免过多并发
	semaphore := make(chan struct{}, 10)

	for _, order := range paidOrders {
		wg.Add(1)
		semaphore <- struct{}{} // 获取信号量

		go func(orderInfo OrderItem) {
			defer wg.Done()
			defer func() { <-semaphore }() // 释放信号量

			err := s.processDouYinOrder(ctx, orderInfo)
			mu.Lock()
			if err != nil {
				failCount++
				s.log.Errorf("SyncDouYinOrder: 处理订单失败, orderId=%s, err=%v", orderInfo.OrderId, err)
			} else {
				successCount++
			}
			mu.Unlock()
		}(order)
	}

	wg.Wait()

	s.log.Infof("SyncDouYinOrder: 同步完成，总数=%d，成功=%d，失败=%d", len(paidOrders), successCount, failCount)
}

// processDouYinOrder 处理单个抖音订单
func (s *ShadowV1OrderUseCase) processDouYinOrder(ctx context.Context, orderInfo OrderItem) error {
	orderId := orderInfo.OrderId
	accountId := constant.DouYinAccountId
	goodName := orderInfo.SkuName
	goodId := orderInfo.SkuId
	goodNum := orderInfo.Count

	s.log.Infof("SyncDouYinOrder: 处理订单, orderId=%s, goodNum=%d", orderId, goodNum)

	// 从订单信息中提取券ID列表
	var certificateIds []string
	for _, cert := range orderInfo.Certificate {
		certificateIds = append(certificateIds, cert.CertificateId)
	}
	s.log.Infof("SyncDouYinOrder: 从订单信息中提取券ID列表，orderId=%s, 券数量=%d, 券ID列表=%v",
		orderId, len(certificateIds), certificateIds)

	// 调用 QueryDouYinCertificate 查询券状态，计算实收金额、优惠金额和支付金额
	var receiptAmount int32 = 0
	var discountAmount int32 = 0
	var platformDiscountAmount int32 = 0
	var paymentDiscountAmount int32 = 0
	var payAmount int = 0 // 支付金额（单位：分）
	var payTime int64 = 0 // 支付时间（秒级时间戳）

	certificateReply, err := s.httpRpc.QueryDouYinCertificate(ctx, &rpc.QueryDouYinCertificateReqParams{
		OrderId:   orderId,
		AccountId: accountId,
	})
	if err != nil {
		s.log.Errorf("SyncDouYinOrder: 查询抖音券状态失败，使用0作为兜底，orderId=%s, err=%v", orderId, err)
		receiptAmount = 0
		discountAmount = 0
		platformDiscountAmount = 0
		paymentDiscountAmount = 0
		payAmount = 0
	} else {
		// 检查是否查询到券信息
		if len(certificateReply.Data.Certificates) == 0 {
			s.log.Warnf("SyncDouYinOrder: 查询抖音券状态返回空数组，使用0作为兜底，orderId=%s", orderId)
			receiptAmount = 0
			discountAmount = 0
			platformDiscountAmount = 0
			paymentDiscountAmount = 0
			payAmount = 0
		} else {
			// 计算实收金额、优惠金额和支付金额
			for _, cert := range certificateReply.Data.Certificates {
				certPayAmount := cert.Amount.PayAmount
				certPlatformDiscountAmount := cert.Amount.PlatformDiscountAmount
				certPaymentDiscountAmount := cert.Amount.PaymentDiscountAmount
				certReceiptAmount := certPayAmount + certPlatformDiscountAmount + certPaymentDiscountAmount
				receiptAmount += int32(certReceiptAmount)
				// 优惠金额 = platformDiscountAmount + paymentDiscountAmount
				certDiscountAmount := certPlatformDiscountAmount + certPaymentDiscountAmount
				discountAmount += int32(certDiscountAmount)
				// 累加平台优惠和支付优惠
				platformDiscountAmount += int32(certPlatformDiscountAmount)
				paymentDiscountAmount += int32(certPaymentDiscountAmount)
				// 累加支付金额
				payAmount += int(certPayAmount)
				s.log.Infof("SyncDouYinOrder: 抖音券实收金额计算，orderId=%s, code=%s, payAmount=%d, platformDiscountAmount=%d, paymentDiscountAmount=%d, certReceiptAmount=%d, certDiscountAmount=%d",
					orderId, cert.Code, certPayAmount, certPlatformDiscountAmount, certPaymentDiscountAmount, certReceiptAmount, certDiscountAmount)
			}
		}
	}
	s.log.Infof("SyncDouYinOrder: 抖音订单金额信息，orderId=%s, payAmount=%d分, receiptAmount=%d分, discountAmount=%d分, platformDiscountAmount=%d分, paymentDiscountAmount=%d分",
		orderId, payAmount, receiptAmount, discountAmount, platformDiscountAmount, paymentDiscountAmount)

	err = s.CreateDouYinOrder(ctx, &CreateOrderReq{
		OrderId:                orderId,
		PayTime:                payTime,
		PayAmount:              payAmount,
		AccountId:              accountId,
		GoodName:               goodName,
		GoodId:                 goodId,
		GoodNum:                int(goodNum),
		ReceiptAmount:          receiptAmount,          // 实收金额（单位：分）
		DiscountAmount:         discountAmount,         // 优惠金额（单位：分）
		PlatformDiscountAmount: platformDiscountAmount, // 平台优惠金额（单位：分）
		PaymentDiscountAmount:  paymentDiscountAmount,  // 支付优惠金额（单位：分）
		CertificateIds:         certificateIds,         // 券ID列表
	})
	if err != nil {
		s.log.Errorf("SyncDouYinOrder: 创建抖音订单失败！订单ID:%s,错误:%v", orderId, err)
		return err
	}

	s.log.Infof("SyncDouYinOrder: 订单处理成功, orderId=%s", orderId)
	return nil
}
