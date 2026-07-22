package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
)

// UpdateDynamicLearnConfigStatus 修改动态学习配置状态
func (d *DynamicLearnConfigV1DynamicLearnConfigUseCase) UpdateDynamicLearnConfigStatus(ctx context.Context, req *pb.UpdateDynamicLearnConfigStatusReq) (*pb.UpdateDynamicLearnConfigStatusReply, error) {
	resp := &pb.UpdateDynamicLearnConfigStatusReply{}
	return resp, nil
}
