package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// GetUserOperationLogList 用户操作记录表-列表数据查询
func (s *ShadowV1UserOperationLogUseCase) GetUserOperationLogList(ctx context.Context, req *pb.GetUserOperationLogListReq) (*pb.GetUserOperationLogListReply, error) {
	resp := &pb.GetUserOperationLogListReply{}
	return resp, nil
}
