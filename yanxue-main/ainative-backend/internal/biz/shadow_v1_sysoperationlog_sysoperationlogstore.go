package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
	"gorm.io/datatypes"
)

// SysOperationLogStore 操作日志-保存
func (s *ShadowV1SysOperationLogUseCase) SysOperationLogStore(ctx context.Context, req *pb.SysOperationLogStoreReq) (*pb.SysOperationLogStoreResp, error) {
	resp := &pb.SysOperationLogStoreResp{}
	err := s.SysOperationLogRepo.CreateOne(ctx, &yanxue_model.SysOperationLog{
		AdminID:   req.GetAdminId(),
		IP:        req.GetIp(),
		Method:    req.GetMethod(),
		URI:       req.GetUri(),
		Useragent: req.GetUseragent(),
		Header:    datatypes.JSON(req.GetHeader()),
		Req:       datatypes.JSON(req.GetReq()),
		Resp:      datatypes.JSON(req.GetResp()),
		CreatedAt: timeutil.NowSQLNullTime(),
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
