package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/task/v1"
)

// TaskFinish 完成任务
func (t *TaskV1TaskUseCase) TaskFinish(ctx context.Context, req *pb.TaskFinishRequest) (*pb.ReplyBool, error) {
	resp := &pb.ReplyBool{}
	return resp, nil
}
