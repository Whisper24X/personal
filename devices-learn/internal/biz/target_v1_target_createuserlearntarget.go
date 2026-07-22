package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/target/v1"
)

// CreateUserLearnTarget 创建用户学习目标
func (t *TargetV1TargetUseCase) CreateUserLearnTarget(ctx context.Context, req *pb.CreateUserLearnTargetRequest) (*pb.UserLearnTargetInfo, error) {
	resp := &pb.UserLearnTargetInfo{}
	return resp, nil
}
