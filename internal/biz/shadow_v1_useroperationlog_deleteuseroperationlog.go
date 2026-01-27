package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// DeleteUserOperationLog 用户操作记录表-删除多条数据
func (s *ShadowV1UserOperationLogUseCase) DeleteUserOperationLog(ctx context.Context, req *pb.DeleteUserOperationLogReq) (*pb.DeleteUserOperationLogReply, error) {
	resp := &pb.DeleteUserOperationLogReply{}
	return resp, nil
}
