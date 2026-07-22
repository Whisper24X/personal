package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
)

// UpdateLearnConfigStatus 更改学习配置状态
func (l *LearnConfigV1LearnConfigUseCase) UpdateLearnConfigStatus(ctx context.Context, req *pb.UpdateLearnConfigStatusReq) (*pb.UpdateLearnConfigStatusReply, error) {
	resp := &pb.UpdateLearnConfigStatusReply{}
	return resp, nil
}
