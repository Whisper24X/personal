package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
)

// StoreLearnConfig 保存学习配置
func (l *LearnConfigV1LearnConfigUseCase) StoreLearnConfig(ctx context.Context, req *pb.StoreLearnConfigReq) (*pb.StoreLearnConfigReply, error) {
	resp := &pb.StoreLearnConfigReply{}
	return resp, nil
}
