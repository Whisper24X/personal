package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_function_config/v1"
)

// StoreDynamicFunctionConfig 保存动态功能配置
func (d *DynamicFunctionConfigV1DynamicFunctionConfigUseCase) StoreDynamicFunctionConfig(ctx context.Context, req *pb.StoreDynamicFunctionConfigReq) (*pb.StoreDynamicFunctionConfigReply, error) {
	resp := &pb.StoreDynamicFunctionConfigReply{}
	return resp, nil
}
