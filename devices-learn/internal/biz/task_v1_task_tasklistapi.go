package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/task/v1"
)

// TaskListApi 任务列表
func (t *TaskV1TaskUseCase) TaskListApi(ctx context.Context, req *pb.TaskListApiRequest) (*pb.TaskListApiReply, error) {
	resp := &pb.TaskListApiReply{}
	return resp, nil
}
