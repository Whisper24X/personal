package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// CreateUserOperationLog 用户操作记录表-创建一条数据
func (s *ShadowV1UserOperationLogUseCase) CreateUserOperationLog(ctx context.Context, req *pb.CreateUserOperationLogReq) (*pb.CreateUserOperationLogReply, error) {
	resp := &pb.CreateUserOperationLogReply{}
	return resp, nil
}
