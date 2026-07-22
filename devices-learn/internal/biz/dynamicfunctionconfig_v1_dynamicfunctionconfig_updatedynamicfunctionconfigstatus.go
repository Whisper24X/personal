package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_function_config/v1"
)

// UpdateDynamicFunctionConfigStatus 修改动态功能配置状态
func (d *DynamicFunctionConfigV1DynamicFunctionConfigUseCase) UpdateDynamicFunctionConfigStatus(ctx context.Context, req *pb.UpdateDynamicFunctionConfigStatusReq) (*pb.UpdateDynamicFunctionConfigStatusReply, error) {
	resp := &pb.UpdateDynamicFunctionConfigStatusReply{}
	return resp, nil
}
