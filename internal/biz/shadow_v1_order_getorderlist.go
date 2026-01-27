package biz

import (
	"context"
	"net/http"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetOrderList 订单-列表数据查询
func (s *ShadowV1OrderUseCase) GetOrderList(ctx context.Context, req *pb.GetOrderListReq) (*pb.GetOrderListReply, error) {
	resp := &pb.GetOrderListReply{}
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
		},
	}

	if req.GetGoodName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "channelGoodId",
			Value: channelGoodIdList,
			Exp:   condition.IN,
			Logic: condition.AND,
		})
	}

	if req.GetChannelId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "channelId",
			Value: req.GetChannelId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	if req.GetOrderStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetOrderStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

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

	orderList, reply, err := s.orderRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = reply.Total

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
	for _, order := range orderList {
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
	for _, order := range orderList {
		phone, err := cryptutil.YcPhoneDecrypt(order.Ph)
		if err != nil {
			return resp, errors.New(http.StatusConflict, "-1", "解析联系方式失败！")
		}
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

		// 处理新增的优惠字段，如果是负数则返回0
		platformDiscountAmount := order.PlatformDiscountAmount
		if platformDiscountAmount < 0 {
			platformDiscountAmount = 0
		}
		paymentDiscountAmount := order.PaymentDiscountAmount
		if paymentDiscountAmount < 0 {
			paymentDiscountAmount = 0
		}
		shopDiscountAmount := order.ShopDiscountAmount
		if shopDiscountAmount < 0 {
			shopDiscountAmount = 0
		}
		actualInsured := order.ActualInsured
		if actualInsured < 0 {
			actualInsured = 0
		}

		orderItem := &pb.OrderInfo{
			Id:                     order.ID,
			GoodId:                 order.GoodID,
			ChannelName:            channelMap[order.ChannelID],
			ChannelId:              order.ChannelID,
			OrderPrice:             int32(order.OrderPrice*100 + 0.5), // 元转分，转为int32，四舍五入
			Phone:                  phone,
			Status:                 order.Status,
			PaymentTime:            TransTimeToRFC3339(order.PaymentTime),
			OrderNumber:            order.OrderNumber,
			GoodName:               goodIdToNameMap[order.GoodID],
			CreatedAt:              order.CreatedAt.Format(time.RFC3339),
			UpdatedAt:              order.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:              order.UpdatedBy,
			UpdatedByName:          operatorIdToNameMap[order.UpdatedBy],
			ChannelGoodId:          order.ChannelGoodID,
			DiscountAmount:         discountAmount,
			PayId:                  order.PayID,
			RefundId:               order.RefundID,
			RefundReason:           order.RefundReason,
			RefundAmount:           float32(order.RefundAmount), // 已经是分
			ParentRemark:           order.ParentRemark,
			RefundTime:             TransTimeToRFC3339(order.RefundTime),
			GoodType:               order.GoodType,
			PlatformFee:            platformFee,
			ServiceStatus:          order.ServiceStatus,
			TalentUid:              order.TalentUID,
			TalentName:             order.TalentName,
			TalentCommission:       talentCommission,
			ReceiptAmount:          order.ReceiptAmount,
			PlatformDiscountAmount: platformDiscountAmount,
			PaymentDiscountAmount:  paymentDiscountAmount,
			ShopDiscountAmount:     shopDiscountAmount,
			ActualInsured:          actualInsured,
		}
		resp.List = append(resp.List, orderItem)
	}

	return resp, nil
}
