package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetCouponAdaptGoodInfoList 查询优惠券适用的商品信息
func (w *WechatV1CouponUseCase) GetCouponAdaptGoodInfoList(ctx context.Context, req *pb.GetCouponAdaptGoodInfoListReq) (*pb.GetCouponAdaptGoodInfoListReply, error) {
	resp := &pb.GetCouponAdaptGoodInfoListReply{
		List: make([]*pb.AdaptGoodInfo, 0),
	}

	// 参数校验
	if req.GetCouponId() == "" {
		return resp, errorx.ParamValidationErr.Err()
	}

	// 查询优惠券信息
	coupon, err := w.couponRepo.FindOneCacheByID(ctx, req.CouponId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 检查优惠券是否存在
	if coupon == nil || coupon.ID == "" {
		return resp, nil
	}

	// 解析适用商品ID列表
	var adaptGoodIds []string
	if coupon.CouponType == string(constant.CouponTypeGood) { // 商品券则查询适用商品
		if len(coupon.AdaptGoodInfo) > 0 {
			err = jsonutil.Unmarshal(coupon.AdaptGoodInfo, &adaptGoodIds)
			if err != nil {
				return resp, errorx.DataFormattingError.WithError(err).Err()
			}
		}
	} else { // 通用券则查询小程序渠道所有上架的商品
		// 先查询小程序的channelId
		param := &condition.Req{
			Query: []*condition.QueryParam{},
			Order: []*condition.OrderParam{
				{
					Field: "createdAt",
					Order: condition.DESC,
				},
			},
		}
		channelList, _, err := w.channelRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		wechatChannelId := ""
		for _, channel := range channelList {
			if channel.Name == constant.ChannelTypeXCX {
				wechatChannelId = channel.ID
				break
			}
		}

		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: string(constant.CouponStatusPutOn),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "channelId",
			Value: wechatChannelId,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
		goodList, _, err := w.goodRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, good := range goodList {
			adaptGoodIds = append(adaptGoodIds, good.ID)
		}
	}

	// 如果没有适用商品，直接返回空列表
	if len(adaptGoodIds) == 0 {
		return resp, nil
	}

	// 批量查询商品信息
	goods, err := w.goodRepo.FindMultiCacheByIDS(ctx, adaptGoodIds)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 过滤掉下架状态的商品，并组装响应数据
	for _, good := range goods {
		// 只返回上架状态的商品
		if good.Status != string(constant.GoodStatusPutOn) {
			continue
		}
		// 过滤掉没有到门槛的商品
		if float64(coupon.MinAmount) > good.Price {
			continue
		}

		// 解析主图
		var mainImages []string
		if len(good.MainImage) > 0 {
			_ = jsonutil.Unmarshal(good.MainImage, &mainImages)
		}

		// 解析详情图
		var detailImages []string
		if len(good.DetailImages) > 0 {
			_ = jsonutil.Unmarshal(good.DetailImages, &detailImages)
		}

		// 组装商品信息
		adaptGoodInfo := &pb.AdaptGoodInfo{
			GoodId:       good.ID,
			GoodName:     good.Name,
			MainImage:    mainImages,
			DetailImages: detailImages,
			Price:        good.Price * 100,
		}

		resp.List = append(resp.List, adaptGoodInfo)
	}

	return resp, nil
}
