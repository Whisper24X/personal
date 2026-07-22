package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
)

// BatchCreateDynamicLearnConfig 批量复制动态学习配置
func (d *DynamicLearnConfigV1DynamicLearnConfigUseCase) BatchCreateDynamicLearnConfig(ctx context.Context, req *pb.BatchCreateDynamicLearnConfigReq) (*pb.BatchCreateDynamicLearnConfigReply, error) {
	resp := &pb.BatchCreateDynamicLearnConfigReply{}
	return resp, nil
}
