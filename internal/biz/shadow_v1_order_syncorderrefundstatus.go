package biz

import (
	"context"
	"sync"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// SendOrderRefundNotification 发送订单退款飞书通知
// 参数：order - 订单信息
func (s *ShadowV1OrderUseCase) SendOrderRefundNotification(ctx context.Context, order *yanxue_model.Order) {
	// 获取渠道信息
	channelInfo, err := s.channelRepo.FindOneCacheByID(ctx, order.ChannelID)
	if err != nil {
		s.log.Warnf("获取渠道信息失败，订单编号：%s，错误：%v", order.OrderNumber, err)
		return
	}
	channelName := ""
	if channelInfo != nil {
		channelName = channelInfo.Name
	}

	// 获取商品信息
	goodInfo, err := s.goodRepo.FindOneCacheByID(ctx, order.GoodID)
	if err != nil {
		s.log.Warnf("获取商品信息失败，订单编号：%s，错误：%v", order.OrderNumber, err)
		return
	}
	goodName := ""
	if goodInfo != nil {
		goodName = goodInfo.Name
	}

	// 获取订单的未完成预约数量
	courseAppointments, err := s.courseAppointmentRepo.FindMultiCacheByOrderID(ctx, order.ID)
	if err != nil {
		s.log.Warnf("获取课程预约信息失败，订单编号：%s，错误：%v", order.OrderNumber, err)
		return
	}

	// 计算未完成预约数量（已预约状态的预约）
	var unFinishedAppointmentCount int32
	for _, appointment := range courseAppointments {
		if appointment.Status == constant.CourseAppointmentStatusSuccess.String() {
			unFinishedAppointmentCount++
		}
	}

	// 如果未完成预约数量为0，则不需要发送通知
	if unFinishedAppointmentCount == 0 {
		return
	}

	// 发送飞书通知
	err = s.orderRepo.OrderRefundFeiShuNotify(ctx, order.OrderNumber, channelName, goodName, unFinishedAppointmentCount)
	if err != nil {
		s.log.Warnf("发送退款飞书通知失败，订单编号：%s，错误：%v", order.OrderNumber, err)
	}
}

// SyncOrderRefundStatus 订单退款状态同步
func (s *ShadowV1OrderUseCase) SyncOrderRefundStatus(ctx context.Context, req *pb.SyncOrderRefundStatusReq) (*pb.SyncOrderRefundStatusReply, error) {
	resp := &pb.SyncOrderRefundStatusReply{}

	err := s.commonRepo.LockOnce(ctx, cache.SyncOrderRefundStatusLock.Key(), cache.SyncOrderRefundStatusLock.TTL(), func() error {
		const pageSize = 100
		reply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
			AccountId:   constant.DouYinAccountId,
			OrderStatus: constant.OrderStatusFinish,
			PageNum:     1,
			PageSize:    pageSize,
		})
		if err != nil {
			s.log.Errorf("获取抖音订单第1页失败：%v", err)
			return err
		}
		if reply == nil {
			s.log.Error("获取抖音订单返回数据为空")
			return nil
		}

		total := reply.Data.Page.Total
		// 计算需要请求的总页数
		totalPages := (total + pageSize - 1) / pageSize // 向上取整
		s.log.Infof("抖音订单总数：%d，总页数：%d", total, totalPages)

		// 已经获取了第一页的数据，从第二页开始请求
		for pageNum := 2; pageNum <= totalPages; pageNum++ {
			pageReply, pageErr := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
				AccountId:   constant.DouYinAccountId,
				OrderStatus: constant.OrderStatusFinish,
				PageNum:     pageNum,
				PageSize:    pageSize,
			})
			if pageErr != nil {
				s.log.Errorf("获取抖音订单第%d页失败：%v", pageNum, pageErr)
				continue
			}
			if pageReply == nil {
				s.log.Errorf("获取抖音订单第%d页返回数据为空", pageNum)
				continue
			}

			// 将当前页的订单数据合并到结果中
			if len(pageReply.Data.Orders) > 0 {
				reply.Data.Orders = append(reply.Data.Orders, pageReply.Data.Orders...)
				s.log.Infof("已获取抖音订单数据：%d/%d", len(reply.Data.Orders), total)
			}
		}

		s.log.Infof("抖音订单数据获取完成，共获取%d条记录", len(reply.Data.Orders))

		// 1. 先筛选出退款券信息（按券维度），只筛选最近7天的数据
		// 优化：改为券维度退款，只退已退款的券对应的订单
		type refundCertificateItem struct {
			OrderId       string // 原始订单ID
			CertificateId string // 券ID
			UpdateTime    int64  // 券更新时间
		}
		var refundCertificateList []refundCertificateItem

		// 计算7天前的时间戳（秒级）
		sevenDaysAgo := time.Now().AddDate(0, 0, -7).Unix()

		for _, order := range reply.Data.Orders {
			for _, item := range order.Certificate {
				if item.ItemStatus == constant.CertificateStatusRefund {
					// 检查 ItemUpdateTime 是否在最近7天内（秒级时间戳）
					itemUpdateTime := int64(item.ItemUpdateTime)
					if itemUpdateTime < sevenDaysAgo {
						s.log.Infof("SyncOrderRefundStatus: 券退款时间超过7天，跳过, orderId=%s, certificateId=%s, itemUpdateTime=%d, sevenDaysAgo=%d",
							order.OrderId, item.CertificateId, itemUpdateTime, sevenDaysAgo)
						continue
					}

					// 记录每张退款券的信息
					refundCertificateList = append(refundCertificateList, refundCertificateItem{
						OrderId:       order.OrderId,
						CertificateId: item.CertificateId,
						UpdateTime:    itemUpdateTime,
					})

					s.log.Infof("SyncOrderRefundStatus: 发现退款券, orderId=%s, certificateId=%s, itemUpdateTime=%d",
						order.OrderId, item.CertificateId, itemUpdateTime)
				}
			}
		}

		s.log.Infof("SyncOrderRefundStatus: 筛选出最近7天的退款券，共%d张", len(refundCertificateList))

		// 2. 通过 QueryDouYinAfterSaleOrderDetail 查询每张退款券的退款信息
		// 按券维度查询退款金额和时间
		type certificateRefundInfo struct {
			UserRefundAmount int64  // 用户退款金额（单位：分）
			CompleteTime     int64  // 完成时间（秒级时间戳）
			CertificateId    string // 券ID
		}
		certificateIdToRefundInfoMap := make(map[string]certificateRefundInfo)

		// 按原始订单ID分组，批量查询售后单详情
		orderIdToCertificatesMap := make(map[string][]refundCertificateItem)
		for _, cert := range refundCertificateList {
			orderIdToCertificatesMap[cert.OrderId] = append(orderIdToCertificatesMap[cert.OrderId], cert)
		}

		for orderId, certificates := range orderIdToCertificatesMap {
			// 调用 QueryDouYinAfterSaleOrderDetail 查询售后单详情
			afterSaleReply, err := s.httpRpc.QueryDouYinAfterSaleOrderDetail(ctx, &rpc.QueryDouYinAfterSaleOrderDetailReqParams{
				AccountId: constant.DouYinAccountId,
				OrderId:   orderId,
			})

			if err != nil {
				s.log.Errorf("SyncOrderRefundStatus: 查询售后单详情失败, orderId=%s, err=%v", orderId, err)
				continue
			}

			// 检查是否有售后单数据
			if len(afterSaleReply.Data.AfterSaleOrderList) == 0 {
				s.log.Warnf("SyncOrderRefundStatus: 订单售后单列表为空, orderId=%s", orderId)
				continue
			}

			// 遍历售后单，提取每张券的退款信息
			for _, afterSaleOrder := range afterSaleReply.Data.AfterSaleOrderList {
				// 遍历退款信息列表
				for _, refundInfo := range afterSaleOrder.RefundInfoList {
					// 检查这张券是否在我们的退款券列表中
					isTargetCertificate := false
					for _, cert := range certificates {
						if cert.CertificateId == refundInfo.CertificateId {
							isTargetCertificate = true
							break
						}
					}

					if !isTargetCertificate {
						continue
					}

					// 提取退款金额和完成时间
					userRefundAmount := refundInfo.UserRefundAmount
					completeTime := afterSaleOrder.CompleteTime

					// 如果退款金额为0，跳过
					if userRefundAmount == 0 {
						s.log.Infof("SyncOrderRefundStatus: 券退款金额为0，跳过, orderId=%s, certificateId=%s",
							orderId, refundInfo.CertificateId)
						continue
					}

					// 如果完成时间为0，使用当前时间作为兜底
					if completeTime == 0 {
						completeTime = time.Now().Unix()
						s.log.Warnf("SyncOrderRefundStatus: 券退款完成时间为0，使用当前时间作为兜底, orderId=%s, certificateId=%s",
							orderId, refundInfo.CertificateId)
					}

					// 保存券的退款信息
					certificateIdToRefundInfoMap[refundInfo.CertificateId] = certificateRefundInfo{
						UserRefundAmount: userRefundAmount,
						CompleteTime:     completeTime,
						CertificateId:    refundInfo.CertificateId,
					}

					s.log.Infof("SyncOrderRefundStatus: 从售后单详情获取券退款信息, orderId=%s, certificateId=%s, userRefundAmount=%d分, completeTime=%d",
						orderId, refundInfo.CertificateId, userRefundAmount, completeTime)
				}
			}
		}

		// 3. 根据 certificateId 匹配数据库中的订单，只退款对应券的订单
		// 按券维度处理退款
		var refundCertificateIds []string
		certificateIdToRefundAmountMap := make(map[string]int32)
		certificateIdToRefundTimeMap := make(map[string]time.Time)

		for _, cert := range refundCertificateList {
			// 如果查询退款信息失败，跳过
			refundInfo, exists := certificateIdToRefundInfoMap[cert.CertificateId]
			if !exists {
				s.log.Warnf("SyncOrderRefundStatus: 未找到券的退款信息, certificateId=%s", cert.CertificateId)
				continue
			}

			refundCertificateIds = append(refundCertificateIds, cert.CertificateId)
			certificateIdToRefundAmountMap[cert.CertificateId] = int32(refundInfo.UserRefundAmount)
			certificateIdToRefundTimeMap[cert.CertificateId] = time.Unix(refundInfo.CompleteTime, 0)

			s.log.Infof("SyncOrderRefundStatus: 准备退款券, certificateId=%s, refundAmount=%d分, refundTime=%s",
				cert.CertificateId, refundInfo.UserRefundAmount, time.Unix(refundInfo.CompleteTime, 0).Format("2006-01-02 15:04:05"))
		}

		// 4. 根据 certificateId 查询数据库中的订单，只更新匹配到的订单
		// 按券维度查询和更新订单
		if len(refundCertificateIds) == 0 {
			s.log.Infof("SyncOrderRefundStatus: 没有需要退款的券")
			return nil
		}

		// 分批查询订单，每批最多1000个券ID
		const batchSize = 1000
		var orderDBList []*yanxue_model.Order

		for i := 0; i < len(refundCertificateIds); i += batchSize {
			end := i + batchSize
			if end > len(refundCertificateIds) {
				end = len(refundCertificateIds)
			}

			batchCertificateIds := refundCertificateIds[i:end]
			batchOrders, err := s.orderRepo.FindMultiByCertificateIDS(ctx, batchCertificateIds)
			if err != nil {
				s.log.Errorf("SyncOrderRefundStatus: 根据券ID查询订单失败, err=%v", err)
				return errorx.DataSQLErr.WithError(err).Err()
			}

			orderDBList = append(orderDBList, batchOrders...)
			s.log.Infof("已查询订单数据：%d/%d券ID", len(orderDBList), len(refundCertificateIds))
		}

		s.log.Infof("SyncOrderRefundStatus: 根据券ID查询到订单，共%d条", len(orderDBList))

		// 筛选需要更新的订单
		var needUpdateOrderList []*yanxue_model.Order
		for _, order := range orderDBList {
			// 如果订单状态小于已退款，则更新
			if constant.OrderStatusRankMap[order.Status] < constant.OrderStatusRankMap[constant.OrderStatusRefunded.String()] {
				needUpdateOrderList = append(needUpdateOrderList, order)
			}
		}

		s.log.Infof("SyncOrderRefundStatus: 需要更新退款状态的订单，共%d条", len(needUpdateOrderList))

		// 并发更新订单和子订单
		wg := &sync.WaitGroup{}
		wg.Add(len(needUpdateOrderList))
		for _, order := range needUpdateOrderList {
			go func(order *yanxue_model.Order) {
				defer wg.Done()

				// 获取该订单对应的券退款信息
				refundAmount, hasRefundAmount := certificateIdToRefundAmountMap[order.CertificateID]
				refundTime, hasRefundTime := certificateIdToRefundTimeMap[order.CertificateID]

				if !hasRefundAmount || !hasRefundTime {
					s.log.Warnf("SyncOrderRefundStatus: 订单券ID未找到退款信息, orderId=%s, certificateId=%s",
						order.ID, order.CertificateID)
					return
				}

				// 更新父订单
				oldOrder := s.orderRepo.DeepCopy(order)
				order.Status = constant.OrderStatusRefunded.String()
				order.RefundAmount = refundAmount
				order.RefundTime = refundTime
				s.orderRepo.UpdateOneCache(context.Background(), order, oldOrder)

				s.log.Infof("SyncOrderRefundStatus: 更新订单退款状态, orderId=%s, orderNumber=%s, certificateId=%s, refundAmount=%d分, refundTime=%s",
					order.ID, order.OrderNumber, order.CertificateID, refundAmount, refundTime.Format("2006-01-02 15:04:05"))

				// 分配退款金额到子订单
				err := DistributeRefundToSubOrders(
					context.Background(),
					order.ID,
					refundAmount,
					order.RefundID,
					order.RefundReason,
					refundTime,
					s.subOrderRepo,
					s.log,
				)
				if err != nil {
					s.log.Errorf("分配退款金额到子订单失败，orderId=%s, err=%v", order.ID, err)
				}

				// 发送退款飞书通知
				go func(order *yanxue_model.Order) {
					s.SendOrderRefundNotification(context.Background(), order)
				}(order)
			}(order)
		}
		wg.Wait()
		return nil
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}
