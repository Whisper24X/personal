package biz

import (
	"context"
	"os"
	"strconv"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// SyncWeiDianRefundOrder 同步微店退款订单
func (s *ShadowV1OrderUseCase) SyncWeiDianRefundOrder(ctx context.Context, accessToken string) error {
	now := time.Now()
	threeMonthsAgo := now.AddDate(0, -3, 0)
	// 当天0点
	startOfDay := time.Date(threeMonthsAgo.Year(), threeMonthsAgo.Month(), threeMonthsAgo.Day(), 0, 0, 0, 0, now.Location())
	// 当天23:59:59
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	layout := "2006-01-02 15:04:05"
	const pageSize = 50
	reply, err := s.httpRpc.QueryWeiDianOrderList(ctx, &rpc.QueryWeiDianOrderListReqParams{
		PageNum:  1,
		PageSize: pageSize,
		AddStart: startOfDay.Format(layout),
		AddEnd:   endOfDay.Format(layout),
	}, accessToken)
	if err != nil {
		s.log.Errorf("获取微店已完成订单第1页失败：%v", err)
		return err
	}
	if reply == nil {
		s.log.Error("获取微店已完成订单返回数据为空")
		return nil
	}

	total := reply.Result.TotalNum
	// 计算需要请求的总页数
	totalPages := (total + pageSize - 1) / pageSize // 向上取整
	s.log.Infof("微店已完成订单总数：%d，总页数：%d", total, totalPages)

	// 已经获取了第一页的数据，从第二页开始请求
	for pageNum := 2; pageNum <= totalPages; pageNum++ {
		pageReply, pageErr := s.httpRpc.QueryWeiDianOrderList(ctx, &rpc.QueryWeiDianOrderListReqParams{
			PageNum:  pageNum,
			PageSize: pageSize,
			AddStart: startOfDay.Format(layout),
			AddEnd:   endOfDay.Format(layout),
		}, accessToken)
		if pageErr != nil {
			s.log.Errorf("获取微店已完成订单第%d页失败：%v", pageNum, pageErr)
			continue
		}
		if pageReply == nil {
			s.log.Errorf("获取微店已完成订单第%d页返回数据为空", pageNum)
			continue
		}

		// 将当前页的订单数据合并到结果中
		if len(pageReply.Result.Orders) > 0 {
			reply.Result.Orders = append(reply.Result.Orders, pageReply.Result.Orders...)
			s.log.Infof("已获取已完成微店订单数据：%d/%d", len(reply.Result.Orders), total)
		}
	}

	s.log.Infof("微店已完成订单数据获取完成，共获取%d条记录", len(reply.Result.Orders))
	// 已退款订单ID
	var refundOrderIds []string
	for _, order := range reply.Result.Orders {
		if order.RefundStatus == constant.WeiDianOrderRefundStatus {
			refundOrderIds = append(refundOrderIds, order.OrderId)
		}
	}

	// 更新订单状态
	var needUpdateOrderList []*yanxue_model.Order
	// 数据库中的订单数据
	// 分批请求，每批最多1000个
	const batchSize = 1000
	var orderDBList []*yanxue_model.Order

	for i := 0; i < len(refundOrderIds); i += batchSize {
		end := i + batchSize
		if end > len(refundOrderIds) {
			end = len(refundOrderIds)
		}

		batchOrderIds := refundOrderIds[i:end]
		batchOrders, err := s.orderRepo.FindMultiByOriginOrderNumbers(ctx, batchOrderIds)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}

		orderDBList = append(orderDBList, batchOrders...)
		s.log.Infof("已查询订单数据：%d/%d", len(orderDBList), len(refundOrderIds))
	}
	for _, order := range orderDBList {
		// 如果订单状态小于已退款，则更新
		if constant.OrderStatusRankMap[order.Status] < constant.OrderStatusRankMap[constant.OrderStatusRefunded.String()] {
			needUpdateOrderList = append(needUpdateOrderList, order)
		}
	}

	s.log.Infof("开始处理微店退款订单，共 %d 个订单需要更新", len(needUpdateOrderList))

	// 按 OriginOrderNumber 分组订单（同一笔微店订单可能拆分成多个父订单）
	originOrderMap := make(map[string][]*yanxue_model.Order)
	for _, order := range needUpdateOrderList {
		originOrderMap[order.OriginOrderNumber] = append(originOrderMap[order.OriginOrderNumber], order)
	}

	s.log.Infof("微店退款订单按原始订单号分组，共 %d 个原始订单", len(originOrderMap))

	// 串行处理订单，避免限流
	successCount := 0
	failCount := 0

	// 遍历每个原始订单号
	for originOrderNumber, orders := range originOrderMap {
		// 查询订单详情获取退款金额
		orderDetail, err := s.httpRpc.QueryWeiDianOrderDetail(context.Background(), &rpc.QueryWeiDianOrderDetailReqParams{
			OrderId: originOrderNumber,
		}, accessToken)

		if err != nil {
			s.log.Errorf("查询微店订单详情失败，originOrderNumber=%s, err=%v", originOrderNumber, err)
			failCount += len(orders)
			continue
		}

		// 计算实际退款金额（单位：分）
		var totalRefundAmount int32 = 0
		var refundNo string
		for _, item := range orderDetail.Result.Items {
			if item.RefundInfo.RefundFee != "" {
				// 退款金额单位为元，需要转换为分
				refundFeeFloat, parseErr := strconv.ParseFloat(item.RefundInfo.RefundFee, 64)
				if parseErr != nil {
					s.log.Errorf("解析退款金额失败，originOrderNumber=%s, refundFee=%s, err=%v",
						originOrderNumber, item.RefundInfo.RefundFee, parseErr)
					continue
				}
				totalRefundAmount += int32(refundFeeFloat*100 + 0.5) // 元转分，四舍五入
			}
			// 获取退款单号（取第一个有效的退款单号）
			if refundNo == "" && item.RefundInfo.RefundNo != "" {
				refundNo = item.RefundInfo.RefundNo
			}
		}

		// 如果没有获取到退款金额，则置为0
		if totalRefundAmount == 0 {
			s.log.Warnf("未获取到退款金额，则置为0，originOrderNumber=%s", originOrderNumber)
			totalRefundAmount = 0
		}

		s.log.Infof("微店订单总退款金额，originOrderNumber=%s, totalRefundAmount=%d分, 父订单数=%d",
			originOrderNumber, totalRefundAmount, len(orders))

		// 从 QueryWeiDianRefundDetail 接口获取退款时间
		var refundTime *time.Time
		if refundNo != "" {
			refundDetail, err := s.httpRpc.QueryWeiDianRefundDetail(context.Background(), &rpc.QueryWeiDianRefundDetailReq{
				RefundNo: refundNo,
			}, accessToken)
			if err != nil {
				s.log.Errorf("查询微店退款详情失败，originOrderNumber=%s, refundNo=%s, err=%v", originOrderNumber, refundNo, err)
			} else if refundDetail.Result.RefundBasicInfo.FinishTime > 0 {
				// 解析退款时间：FinishTime 是毫秒级时间戳，转换为东八区时间
				parsedTime := time.Unix(0, refundDetail.Result.RefundBasicInfo.FinishTime*int64(time.Millisecond))
				refundTime = &parsedTime
				s.log.Infof("从退款详情获取退款时间，originOrderNumber=%s, refundNo=%s, refundTime=%s",
					originOrderNumber, refundNo, refundTime.Format("2006-01-02 15:04:05.000000-07"))
			} else {
				s.log.Warnf("退款详情中退款时间为空或为0，originOrderNumber=%s, refundNo=%s", originOrderNumber, refundNo)
			}
		} else {
			s.log.Warnf("未获取到退款单号，无法查询退款时间，originOrderNumber=%s", originOrderNumber)
		}

		// 计算每个父订单的退款金额（平均分配，最后一个补齐差额）
		orderCount := int32(len(orders))
		avgRefundAmount := totalRefundAmount / orderCount

		s.log.Infof("微店订单退款金额分配，originOrderNumber=%s, 平均退款=%d分, 订单数=%d",
			originOrderNumber, avgRefundAmount, orderCount)

		// 处理每个父订单
		for i, order := range orders {
			// 计算当前订单的退款金额
			var orderRefundAmount int32
			if i == len(orders)-1 {
				// 最后一个订单补齐差额
				orderRefundAmount = totalRefundAmount - (avgRefundAmount * (orderCount - 1))
			} else {
				orderRefundAmount = avgRefundAmount
			}

			s.log.Infof("微店父订单退款金额，orderId=%s, orderNumber=%s, refundAmount=%d分",
				order.ID, order.OrderNumber, orderRefundAmount)

			// 更新订单状态
			oldOrder := s.orderRepo.DeepCopy(order)
			order.Status = constant.OrderStatusRefunded.String()
			order.RefundAmount = orderRefundAmount
			// 只有在成功获取到退款时间时才更新
			if refundTime != nil {
				order.RefundTime = *refundTime
			}
			err = s.orderRepo.UpdateOneCache(context.Background(), order, oldOrder)
			if err != nil {
				s.log.Errorf("更新订单状态失败，orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			// 分配退款金额到子订单
			err = DistributeRefundToSubOrders(
				context.Background(),
				order.ID,
				orderRefundAmount,
				order.RefundID,
				order.RefundReason,
				order.RefundTime,
				s.subOrderRepo,
				s.log,
			)
			if err != nil {
				s.log.Errorf("分配退款金额到子订单失败，orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			// 发送退款飞书通知
			go func(order *yanxue_model.Order) {
				s.SendOrderRefundNotification(context.Background(), order)
			}(order)

			successCount++
			s.log.Infof("微店订单退款处理成功，orderId=%s, orderNumber=%s, 进度=%d/%d",
				order.ID, order.OrderNumber, successCount+failCount, len(needUpdateOrderList))
		}
	}

	s.log.Infof("微店退款订单处理完成，总数=%d, 成功=%d, 失败=%d", len(needUpdateOrderList), successCount, failCount)
	return nil
}

// SyncWeiDianNewOrder 同步微店新建订单
func (s *ShadowV1OrderUseCase) SyncWeiDianNewOrder(ctx context.Context, accessToken string) error {
	now := time.Now()
	// 当天0点
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	// 当天23:59:59
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	layout := "2006-01-02 15:04:05"
	const pageSize = 50
	reply, err := s.httpRpc.QueryWeiDianOrderList(ctx, &rpc.QueryWeiDianOrderListReqParams{
		PageNum:  1,
		PageSize: pageSize,
		AddStart: startOfDay.Format(layout),
		AddEnd:   endOfDay.Format(layout),
	}, accessToken)
	if err != nil {
		s.log.Errorf("获取微店订单第1页失败：%v", err)
		return err
	}
	if reply == nil {
		s.log.Error("获取微店订单返回数据为空")
		return nil
	}

	total := reply.Result.TotalNum
	// 计算需要请求的总页数
	totalPages := (total + pageSize - 1) / pageSize // 向上取整
	s.log.Infof("微店订单总数：%d，总页数：%d", total, totalPages)

	// 已经获取了第一页的数据，从第二页开始请求
	for pageNum := 2; pageNum <= totalPages; pageNum++ {
		pageReply, pageErr := s.httpRpc.QueryWeiDianOrderList(ctx, &rpc.QueryWeiDianOrderListReqParams{
			PageNum:  pageNum,
			PageSize: pageSize,
			AddStart: startOfDay.Format(layout),
			AddEnd:   endOfDay.Format(layout),
		}, accessToken)
		if pageErr != nil {
			s.log.Errorf("获取微店订单第%d页失败：%v", pageNum, pageErr)
			continue
		}
		if pageReply == nil {
			s.log.Errorf("获取微店订单第%d页返回数据为空", pageNum)
			continue
		}

		// 将当前页的订单数据合并到结果中
		if len(pageReply.Result.Orders) > 0 {
			reply.Result.Orders = append(reply.Result.Orders, pageReply.Result.Orders...)
			s.log.Infof("已获取微店订单数据：%d/%d", len(reply.Result.Orders), total)
		}
	}

	s.log.Infof("微店订单数据获取完成，共获取%d条记录", len(reply.Result.Orders))
	var orderIds []string
	for _, order := range reply.Result.Orders {
		orderIds = append(orderIds, order.OrderId)
	}

	for _, orderId := range orderIds {
		orderDetail, err := s.httpRpc.QueryWeiDianOrderDetail(ctx, &rpc.QueryWeiDianOrderDetailReqParams{
			OrderId: orderId,
		}, accessToken)
		if err != nil {
			s.log.Errorf("获取微店订单详情失败：%v，订单ID: %s", err, orderId)
			continue
		}
		s.log.Infof("获取微店订单详情成功，订单ID: %s", orderDetail.Result.OrderID)
		phone := orderDetail.Result.BuyerInfo.Phone
		if orderDetail.Result.Status == constant.WeiDianOrderUnPayStatusStr ||
			orderDetail.Result.Status == constant.WeiDianOrderCloseStatusStr {
			s.log.Infof("订单状态为未支付或已关闭，跳过订单ID: %s", orderDetail.Result.OrderID)
			continue
		}
		var weiDianOrderGoodInfoList []*WeiDianOrderGoodInfo
		for _, item := range orderDetail.Result.Items {
			weiDianOrderGoodInfoList = append(weiDianOrderGoodInfoList, &WeiDianOrderGoodInfo{
				PayAmount:  item.TotalPrice,
				GoodName:   item.ItemName,
				GoodId:     item.ItemID,
				GoodNum:    item.Quantity,
				Phone:      phone,
				LastIncome: orderDetail.Result.LastIncome,
			})
		}
		err = s.CreateWeiDianOrder(ctx, &CreateWeiDianOrderReq{
			OrderId:                  orderDetail.Result.OrderID,
			PayTime:                  orderDetail.Result.PayTime,
			WeiDianOrderGoodInfoList: weiDianOrderGoodInfoList,
		})
		if err != nil {
			s.log.Errorf("创建微店订单失败：%v，订单ID: %s", err, orderId)
		}

	}
	return nil
}

// SyncWeiDianOrder 微店订单同步
func (s *ShadowV1OrderUseCase) SyncWeiDianOrder(ctx context.Context, req *pb.SyncWeiDianOrderReq) (*pb.SyncWeiDianOrderReply, error) {
	resp := &pb.SyncWeiDianOrderReply{}
	err := s.commonRepo.LockOnce(ctx, cache.SyncWeiDianOrderInfoLock.Key(), cache.SyncWeiDianOrderInfoLock.TTL(), func() error {
		token, err := s.orderRepo.CacheWeiDianAccessTokenGet(ctx)
		if err != nil {
			return err
		}
		accessToken := token
		if token == "" {
			// 如果是测试环境或预发环境，则不调用token刷新接口
			goEnv := os.Getenv("GO_ENV")
			if goEnv == "test" || goEnv == "stage" {
				s.log.Warnf("测试环境或预发环境，跳过微店token刷新，GO_ENV=%s", goEnv)
				return nil
			}
			accessToken, err = s.httpRpc.GetWeiDianAccessToken(ctx)
			if err != nil {
				return err
			}
			if accessToken == "" {
				return nil
			}
			s.orderRepo.CacheWeiDianAccessTokenSet(ctx, accessToken)
		}
		// 同步新创建订单
		s.SyncWeiDianNewOrder(ctx, accessToken)
		// 同步退款订单
		s.SyncWeiDianRefundOrder(ctx, accessToken)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}
