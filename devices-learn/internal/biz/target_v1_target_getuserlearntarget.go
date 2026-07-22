package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/target/v1"
)

// GetUserLearnTarget 查询用户学习目标
func (t *TargetV1TargetUseCase) GetUserLearnTarget(ctx context.Context, req *pb.GetUserLearnTargetRequest) (*pb.UserLearnTargetInfo, error) {
	resp := &pb.UserLearnTargetInfo{}
	return resp, nil
}
