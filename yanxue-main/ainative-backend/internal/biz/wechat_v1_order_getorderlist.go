package biz

import (
	"context"
	"sort"
	"time"

	"github.com/samber/lo"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetOrderList 订单-获取用户订单列表
func (w *WechatV1OrderUseCase) GetOrderList(ctx context.Context, req *pb.GetOrderListReq) (*pb.GetOrderListReply, error) {
	resp := &pb.GetOrderListReply{}
	// 获取用户ID
	userId := meta.GetUserID(ctx)
	// 查询用户信息
	userInfo, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询用户所有的订单
	orderList, err := w.orderRepo.FindMultiCacheByPh(ctx, userInfo.Ph)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	var newOrderList []*yanxue_model.Order
	now := time.Now()
	for _, order := range orderList {
		// 如果订单状态为待支付，且当前时间超过支付截止时间，则将订单状态改为交易关闭
		if now.After(order.PaymentDeadline) && order.Status == string(constant.OrderStatusPendingPayment) {
			order.Status = string(constant.OrderStatusClosed)
		}
		newOrderList = append(newOrderList, order)
	}
	if len(req.GetStatus()) > 0 {
		orderList = lo.Filter(newOrderList, func(order *yanxue_model.Order, _ int) bool {
			for _, status := range req.GetStatus() {
				if order.Status == status {
					return true
				}
			}
			return false
		})
	}
	if len(req.GetServiceStatus()) > 0 {
		orderList = lo.Filter(newOrderList, func(order *yanxue_model.Order, _ int) bool {
			for _, serviceStatus := range req.GetServiceStatus() {
				// 订单状态为退款中或已退款，则过滤掉
				if order.Status == string(constant.OrderStatusRefunded) ||
					order.Status == string(constant.OrderStatusRefunding) {
					return false
				}
				if order.ServiceStatus == serviceStatus {
					return true
				}
			}
			return false
		})
	}
	//排序 待支付、待预约、已预约、已完成、已退款、交易关闭（从上往下），每一种状态按时间倒序排序
	// pendingPayment // 待支付
	// pending // 待预约
	// success // 已预约
	// completed // 已完成
	// refunded // 已退款
	// closed // 交易关闭
	// 定义订单状态优先级
	statusPriority := map[string]int{
		"pendingPayment": 0, // 待支付
		"pending":        1, // 待预约
		"success":        2, // 已预约
		"completed":      3, // 已完成
		"refunded":       4, // 已退款
		"closed":         5, // 交易关闭
		"refunding":      6, // 退款中
		"failedRefund":   7, // 退款失败
	}
	// 按状态优先级和时间排序
	sort.Slice(orderList, func(i, j int) bool {
		// 首先按状态优先级排序
		if statusPriority[string(orderList[i].Status)] != statusPriority[string(orderList[j].Status)] {
			return statusPriority[string(orderList[i].Status)] < statusPriority[string(orderList[j].Status)]
		}
		// 状态相同时，按创建时间倒序排序
		return orderList[i].CreatedAt.After(orderList[j].CreatedAt)
	})
	resp.Total = int32(len(orderList))

	// 手动分页逻辑
	start := (req.GetPage() - 1) * req.GetPageSize()
	end := start + req.GetPageSize()
	if end > int32(len(orderList)) {
		end = int32(len(orderList))
	}
	list := orderList[start:end]
	goodIds := make([]string, 0)
	for _, order := range list {
		goodIds = append(goodIds, order.GoodID)
	}
	goodIdToName, err := w.goodRepo.GoodIdToName(ctx, goodIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	channelIdToName, err := w.channelRepo.ChannelIdToName(ctx)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	var platformGoodIds []string
	goodList, err := w.goodRepo.FindMultiByIDS(ctx, goodIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, good := range goodList {
		platformGoodIds = append(platformGoodIds, good.PlatformGoodID)
	}
	platformGoodIdToGoodType, err := w.platformGoodRepo.PlatformGoodIdToGoodType(ctx, platformGoodIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	goodIdToGoodTypeMap := make(map[string]string)
	for _, good := range goodList {
		goodIdToGoodTypeMap[good.ID] = platformGoodIdToGoodType[good.PlatformGoodID]
	}
	for _, order := range list {
		phone, err := cryptutil.YcPhoneDecrypt(order.Ph)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
		orderInfo := &pb.OrderInfo{
			Id:            order.ID,
			OrderNumber:   order.OrderNumber,
			GoodId:        order.GoodID,
			GoodName:      goodIdToName[order.GoodID],
			ChannelId:     order.ChannelID,
			ChannelName:   channelIdToName[order.ChannelID],
			OrderPrice:    int32(order.OrderPrice*100 + 0.5), // 数据库存储的是元，转换为分返回给前端，四舍五入
			Phone:         phone,
			PaymentTime:   timeutil.RFC3339(order.PaymentTime),
			Status:        order.Status,
			CreatedAt:     timeutil.RFC3339(order.CreatedAt),
			UpdatedAt:     timeutil.RFC3339(order.UpdatedAt),
			GoodType:      goodIdToGoodTypeMap[order.GoodID],
			ServiceStatus: order.ServiceStatus,
		}
		resp.OrderList = append(resp.OrderList, orderInfo)
	}

	return resp, nil
}
