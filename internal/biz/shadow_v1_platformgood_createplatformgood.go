package biz

import (
	"context"
	"net/http"
	"unicode/utf8"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// CreatePlatformGood 平台商品-创建一条数据
func (s *ShadowV1PlatformGoodUseCase) CreatePlatformGood(ctx context.Context, req *pb.CreatePlatformGoodReq) (*pb.CreatePlatformGoodReply, error) {
	resp := &pb.CreatePlatformGoodReply{}
	adminId := meta.GetAdminID(ctx)
	// 校验商品类型是否正确
	if req.GetGoodType() != string(constant.GoodTypeSingle) &&
		req.GetGoodType() != string(constant.GoodTypeMulti) &&
		req.GetGoodType() != string(constant.GoodTypeDeposit) {
		return resp, errors.New(http.StatusBadRequest, "-1", "商品类型不正确！")
	}
	platformGood := &yanxue_model.PlatformGood{
		Name:      req.GetName(),
		UpdatedBy: adminId,
		GoodType:  req.GetGoodType(),
	}
	if utf8.RuneCountInString(req.GetName()) > 50 {
		return resp, errors.New(http.StatusBadRequest, "-1", "商品名称不能超过50个字符！")
	}
	// 先校验是否有同名商品，有则报错
	goodList, err := s.platformGoodRepo.FindMultiByName(ctx, req.GetName())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(goodList) > 0 {
		return resp, errors.New(http.StatusBadRequest, "-1", "已存在同名商品！")
	}
	err = s.platformGoodRepo.CreateOneCache(ctx, platformGood)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = platformGood.ID
	return resp, nil
}
