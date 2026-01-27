package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// UpdateUserOperationLog 用户操作记录表-更新一条数据
func (s *ShadowV1UserOperationLogUseCase) UpdateUserOperationLog(ctx context.Context, req *pb.UpdateUserOperationLogReq) (*pb.UpdateUserOperationLogReply, error) {
	resp := &pb.UpdateUserOperationLogReply{}
	return resp, nil
}
