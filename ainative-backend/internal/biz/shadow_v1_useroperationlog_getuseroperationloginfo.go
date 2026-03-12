package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// GetUserOperationLogInfo 用户操作记录表-单条数据查询
func (s *ShadowV1UserOperationLogUseCase) GetUserOperationLogInfo(ctx context.Context, req *pb.GetUserOperationLogInfoReq) (*pb.GetUserOperationLogInfoReply, error) {
	resp := &pb.GetUserOperationLogInfoReply{}
	return resp, nil
}
