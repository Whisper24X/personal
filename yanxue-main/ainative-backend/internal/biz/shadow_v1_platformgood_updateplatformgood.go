package biz

import (
	"context"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdatePlatformGood 平台商品-更新一条数据
func (s *ShadowV1PlatformGoodUseCase) UpdatePlatformGood(ctx context.Context, req *pb.UpdatePlatformGoodReq) (*pb.UpdatePlatformGoodReply, error) {
	resp := &pb.UpdatePlatformGoodReply{}
	adminId := meta.GetAdminID(ctx)
	platformGood, err := s.platformGoodRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	oldPlatformGood := s.platformGoodRepo.DeepCopy(platformGood)
	platformGood.Name = req.GetName()
	platformGood.UpdatedBy = adminId
	err = s.platformGoodRepo.UpdateOneCacheWithZero(ctx, platformGood, oldPlatformGood)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	// 同步修改商品名称
	goodList, err := s.goodRepo.FindMultiByPlatformGoodID(ctx, platformGood.ID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, good := range goodList {
		oldGood := s.goodRepo.DeepCopy(good)
		good.Name = req.GetName()
		err = s.goodRepo.UpdateOneCache(ctx, good, oldGood)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
	}
	return resp, nil
}
