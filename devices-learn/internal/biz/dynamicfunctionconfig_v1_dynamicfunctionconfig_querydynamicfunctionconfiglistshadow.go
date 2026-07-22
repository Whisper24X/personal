package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_function_config/v1"
)

// QueryDynamicFunctionConfigListShadow shadow查询动态功能配置列表
func (d *DynamicFunctionConfigV1DynamicFunctionConfigUseCase) QueryDynamicFunctionConfigListShadow(ctx context.Context, req *pb.QueryDynamicFunctionConfigListShadowReq) (*pb.QueryDynamicFunctionConfigListShadowReply, error) {
	resp := &pb.QueryDynamicFunctionConfigListShadowReply{}
	return resp, nil
}
