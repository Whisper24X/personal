package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
)

// StoreDynamicLearnConfig 保存动态学习配置
func (d *DynamicLearnConfigV1DynamicLearnConfigUseCase) StoreDynamicLearnConfig(ctx context.Context, req *pb.StoreDynamicLearnConfigReq) (*pb.StoreDynamicLearnConfigReply, error) {
	resp := &pb.StoreDynamicLearnConfigReply{}
	return resp, nil
}
