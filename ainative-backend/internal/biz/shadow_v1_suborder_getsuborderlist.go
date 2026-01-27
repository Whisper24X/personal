package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetSubOrderList 子订单-列表数据查询
func (s *ShadowV1SubOrderUseCase) GetSubOrderList(ctx context.Context, req *pb.GetSubOrderListReq) (*pb.GetSubOrderListReply, error) {
	resp := &pb.GetSubOrderListReply{
		List: make([]*pb.SubOrderInfo, 0),
	}

	page := int32(1)
	pageSize := int32(10)
	if req.GetPage() > 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() > 0 {
		pageSize = req.GetPageSize()
	}

	// 如果有传入商品名称，则先查询商品表，获得商品ID
	var channelGoodIdList []string
	if req.GetGoodName() != "" {
		goodParam := &condition.Req{
			Query: []*condition.QueryParam{},
			Order: []*condition.OrderParam{
				{
					Field: "createdAt",
					Order: condition.DESC,
				},
			},
		}
		goodParam.Query = append(goodParam.Query, &condition.QueryParam{
			Field: "name",
			Value: "%" + req.GetGoodName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
		goodDBList, _, err := s.goodRepo.FindMultiByCondition(ctx, goodParam)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, item := range goodDBList {
			channelGoodIdList = append(channelGoodIdList, item.ChannelGoodID)
		}
	}

	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
			{
				Field: "id",
				Order: condition.DESC,
			},
		},
	}

	// 商品名称（通过channelGoodId查询）
	if req.GetGoodName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "channelGoodId",
			Value: channelGoodIdList,
			Exp:   condition.IN,
			Logic: condition.AND,
		})
	}

	// 渠道ID
	if req.GetChannelId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "channelId",
			Value: req.GetChannelId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 订单状态
	if req.GetOrderStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetOrderStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 支付时间范围
	if req.GetPaymentTimeStart() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "paymentTime",
			Value: timeutil.Carbon().Parse(req.GetPaymentTimeStart()).StartOfDay().ToStdTime(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}

	if req.GetPaymentTimeEnd() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "paymentTime",
			Value: timeutil.Carbon().Parse(req.GetPaymentTimeEnd()).EndOfDay().ToStdTime(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}

	// 订单编号
	if req.GetOrderNumber() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "orderNumber",
			Value: "%" + req.GetOrderNumber() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}

	// 手机号
	if req.GetPhone() != "" {
		// 手机号加密
		ph, err := cryptutil.YcPhoneEncrypt(req.GetPhone())
		if err != nil {
			return resp, errorx.ParamPhoneInvalid.Err()
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "ph",
			Value: ph,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 服务状态
	if req.GetServiceStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "serviceStatus",
			Value: req.GetServiceStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 商品类型
	if req.GetGoodType() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "goodType",
			Value: req.GetGoodType(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 退款时间范围
	if req.GetRefundTimeStart() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "refundTime",
			Value: timeutil.Carbon().Parse(req.GetRefundTimeStart()).StartOfDay().ToStdTime(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}

	if req.GetRefundTimeEnd() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "refundTime",
			Value: timeutil.Carbon().Parse(req.GetRefundTimeEnd()).EndOfDay().ToStdTime(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}

	// 父订单ID
	if req.GetParentOrderId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "parentOrderId",
			Value: req.GetParentOrderId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 参营时间范围（campTime是字符串类型，使用字符串比较）
	if req.GetCampTimeStart() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "campTime",
			Value: req.GetCampTimeStart(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}

	if req.GetCampTimeEnd() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "campTime",
			Value: req.GetCampTimeEnd(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}

	// 查询子订单列表
	subOrderList, reply, err := s.subOrderRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 设置总数
	resp.Total = int32(reply.Total)

	// 如果没有子订单，直接返回空列表
	if len(subOrderList) == 0 {
		return resp, nil
	}

	// 收集商品ID、渠道ID和管理员ID用于批量查询
	var goodIds []string
	var channelIds []string
	var updatedBys []string
	channelIdSet := make(map[string]bool)
	for _, subOrder := range subOrderList {
		if subOrder.GoodID != "" {
			goodIds = append(goodIds, subOrder.GoodID)
		}
		if subOrder.ChannelID != "" && !channelIdSet[subOrder.ChannelID] {
			channelIds = append(channelIds, subOrder.ChannelID)
			channelIdSet[subOrder.ChannelID] = true
		}
		if subOrder.UpdatedBy != "" {
			updatedBys = append(updatedBys, subOrder.UpdatedBy)
		}
	}

	// 查询商品信息
	goodIdToNameMap := make(map[string]string)
	if len(goodIds) > 0 {
		goodIdToName, err := s.goodRepo.GoodIdToName(ctx, goodIds)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		goodIdToNameMap = goodIdToName
	}

	// 查询渠道信息
	channelIdToNameMap := make(map[string]string)
	if len(channelIds) > 0 {
		channelList, err := s.channelRepo.FindMultiCacheByIDS(ctx, channelIds)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, channel := range channelList {
			channelIdToNameMap[channel.ID] = channel.Name
		}
	}

	// 查询管理员信息
	operatorIdToNameMap := make(map[string]string)
	if len(updatedBys) > 0 {
		operatorIdToName, err := s.sysAdminRepo.AdminIdToName(ctx, updatedBys)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		operatorIdToNameMap = operatorIdToName
	}

	// 组装返回数据
	for _, subOrder := range subOrderList {
		// 解密手机号
		phone, err := cryptutil.YcPhoneDecrypt(subOrder.Ph)
		if err != nil {
			s.log.Errorf("解密手机号失败: subOrderId=%s, err=%v", subOrder.ID, err)
			phone = "" // 解密失败时返回空字符串
		}

		// 处理负数字段，如果是负数则返回0
		discountAmount := subOrder.DiscountAmount
		if discountAmount < 0 {
			discountAmount = 0
		}
		platformFee := subOrder.PlatformFee
		if platformFee < 0 {
			platformFee = 0
		}
		talentCommission := subOrder.TalentCommission
		if talentCommission < 0 {
			talentCommission = 0
		}
		platformDiscountAmount := subOrder.PlatformDiscountAmount
		if platformDiscountAmount < 0 {
			platformDiscountAmount = 0
		}
		paymentDiscountAmount := subOrder.PaymentDiscountAmount
		if paymentDiscountAmount < 0 {
			paymentDiscountAmount = 0
		}
		shopDiscountAmount := subOrder.ShopDiscountAmount
		if shopDiscountAmount < 0 {
			shopDiscountAmount = 0
		}
		actualInsured := subOrder.ActualInsured
		if actualInsured < 0 {
			actualInsured = 0
		}

		subOrderInfo := &pb.SubOrderInfo{
			Id:                     subOrder.ID,
			ParentOrderId:          subOrder.ParentOrderID,
			ChannelId:              subOrder.ChannelID,
			GoodId:                 subOrder.GoodID,
			ChannelGoodId:          subOrder.ChannelGoodID,
			OrderNumber:            subOrder.OrderNumber,
			OrderPrice:             subOrder.OrderPrice, // 数据库已经是分，直接使用
			PaymentTime:            TransTimeToRFC3339(subOrder.PaymentTime),
			Phone:                  phone,
			Status:                 subOrder.Status,
			CreatedAt:              subOrder.CreatedAt.Format(time.RFC3339),
			UpdatedAt:              subOrder.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:              subOrder.UpdatedBy,
			GoodName:               goodIdToNameMap[subOrder.GoodID],
			ChannelName:            channelIdToNameMap[subOrder.ChannelID],
			DiscountAmount:         discountAmount,
			UpdatedByName:          operatorIdToNameMap[subOrder.UpdatedBy],
			PayId:                  subOrder.PayID,
			RefundId:               subOrder.RefundID,
			RefundReason:           subOrder.RefundReason,
			RefundAmount:           float32(subOrder.RefundAmount), // 数据库已经是分，直接使用
			ParentRemark:           subOrder.ParentRemark,
			RefundTime:             TransTimeToRFC3339(subOrder.RefundTime),
			GoodType:               subOrder.GoodType,
			PlatformFee:            platformFee,
			ServiceStatus:          subOrder.ServiceStatus,
			TalentUid:              subOrder.TalentUID,
			TalentName:             subOrder.TalentName,
			TalentCommission:       talentCommission,
			ReceiptAmount:          subOrder.ReceiptAmount,
			CampTime:               subOrder.CampTime, // 参营时间（字符串类型）
			PlatformDiscountAmount: platformDiscountAmount,
			PaymentDiscountAmount:  paymentDiscountAmount,
			ShopDiscountAmount:     shopDiscountAmount,
			ActualInsured:          actualInsured,
		}

		resp.List = append(resp.List, subOrderInfo)
	}

	return resp, nil
}
