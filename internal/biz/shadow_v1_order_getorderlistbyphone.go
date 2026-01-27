package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// GetOrderListByPhone 订单-手机号查询订单
func (s *ShadowV1OrderUseCase) GetOrderListByPhone(ctx context.Context, req *pb.GetOrderListByPhoneReq) (*pb.GetOrderListByPhoneReply, error) {
	resp := &pb.GetOrderListByPhoneReply{
		List: []*pb.OrderInfo{},
	}
	ph, err := cryptutil.YcPhoneEncrypt(req.GetPhone())
	if err != nil {
		return nil, err
	}
	list, err := s.orderRepo.FindMultiCacheByPh(ctx, ph)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return resp, nil
	}
	// 查询渠道信息
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	channelMap := make(map[string]string)
	for _, channel := range channelList {
		channelMap[channel.ID] = channel.Name
	}

	var goodIds []string
	var updatedBys []string
	for _, order := range list {
		goodIds = append(goodIds, order.GoodID)
		updatedBys = append(updatedBys, order.UpdatedBy)
	}
	// 查询商品信息
	goodIdToNameMap, err := s.goodRepo.GoodIdToName(ctx, goodIds)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	operatorIdToNameMap, err := s.sysAdminRepo.AdminIdToName(ctx, updatedBys)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, order := range list {
		// 处理负数字段，如果是负数则返回0
		discountAmount := order.DiscountAmount // 单位：分
		if discountAmount < 0 {
			discountAmount = 0
		}
		platformFee := order.PlatformFee
		if platformFee < 0 {
			platformFee = 0
		}
		talentCommission := order.TalentCommission
		if talentCommission < 0 {
			talentCommission = 0
		}

		resp.List = append(resp.List, &pb.OrderInfo{
			Id:               order.ID,
			GoodId:           order.GoodID,
			ChannelName:      channelMap[order.ChannelID],
			ChannelId:        order.ChannelID,
			OrderPrice:       int32(order.OrderPrice*100 + 0.5), // 元转分，转为int32，四舍五入
			Phone:            ph,
			Status:           order.Status,
			PaymentTime:      order.PaymentTime.Format(time.RFC3339),
			OrderNumber:      order.OrderNumber,
			GoodName:         goodIdToNameMap[order.GoodID],
			CreatedAt:        order.CreatedAt.Format(time.RFC3339),
			UpdatedAt:        order.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:        order.UpdatedBy,
			UpdatedByName:    operatorIdToNameMap[order.UpdatedBy],
			ChannelGoodId:    order.ChannelGoodID,
			DiscountAmount:   discountAmount,
			PayId:            order.PayID,
			RefundId:         order.RefundID,
			RefundReason:     order.RefundReason,
			RefundAmount:     float32(order.RefundAmount), // 已经是分
			ParentRemark:     order.ParentRemark,
			RefundTime:       order.RefundTime.Format(time.RFC3339),
			GoodType:         order.GoodType,
			PlatformFee:      platformFee,
			ServiceStatus:    order.ServiceStatus,
			TalentUid:        order.TalentUID,
			TalentName:       order.TalentName,
			TalentCommission: talentCommission,
			ReceiptAmount:    order.ReceiptAmount,
		})
	}
	return resp, nil
}
