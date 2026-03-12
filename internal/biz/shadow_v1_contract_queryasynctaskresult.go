package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// QueryAsyncTaskResult 查询异步任务结果
func (s *ShadowV1ContractUseCase) QueryAsyncTaskResult(ctx context.Context, req *pb.QueryAsyncTaskResultReq) (*pb.QueryAsyncTaskResultReply, error) {
	resp := &pb.QueryAsyncTaskResultReply{}
	asyncTaskItem, err := s.asyncTaskRepo.FindOneByID(ctx, req.GetTaskId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.TaskId = asyncTaskItem.ID
	resp.Status = asyncTaskItem.Status
	resp.ErrorInfo = asyncTaskItem.ErrorInfo
	return resp, nil
}
