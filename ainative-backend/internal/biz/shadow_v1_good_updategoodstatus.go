package biz

import (
	"context"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGoodStatus 商品-修改商品状态
func (s *ShadowV1GoodUseCase) UpdateGoodStatus(ctx context.Context, req *pb.UpdateGoodStatusReq) (*pb.UpdateGoodStatusReply, error) {
	resp := &pb.UpdateGoodStatusReply{}
	// 状态修改只有上架和下架
	if !lo.Contains([]string{constant.GoodStatusPutOn.String(), constant.GoodStatusPutOff.String()}, req.GetStatus()) {
		return resp, errorx.GoodStatusNotAllowed.Err()
	}
	adminId := meta.GetAdminID(ctx)
	goodInfo, err := s.goodRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if goodInfo == nil || goodInfo.ID == "" {
		return resp, errorx.GoodNotExists.Err()
	}
	oldGoodInfo := s.goodRepo.DeepCopy(goodInfo)
	goodInfo.Status = req.GetStatus()
	goodInfo.UpdatedBy = adminId
	err = s.goodRepo.UpdateOneCacheWithZero(ctx, goodInfo, oldGoodInfo)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.IsSucceed = true
	return resp, nil
}
