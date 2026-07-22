package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/task/v1"
)

// TaskReward 领取任务奖励
func (t *TaskV1TaskUseCase) TaskReward(ctx context.Context, req *pb.TaskRewardRequest) (*pb.TaskRewardReply, error) {
	resp := &pb.TaskRewardReply{}
	return resp, nil
}
