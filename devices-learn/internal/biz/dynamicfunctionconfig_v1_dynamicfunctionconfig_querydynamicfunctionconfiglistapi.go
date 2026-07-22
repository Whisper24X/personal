package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_function_config/v1"
)

// QueryDynamicFunctionConfigListApi 客户端查询动态功能配置列表
func (d *DynamicFunctionConfigV1DynamicFunctionConfigUseCase) QueryDynamicFunctionConfigListApi(ctx context.Context, req *pb.QueryDynamicFunctionConfigListApiReq) (*pb.QueryDynamicFunctionConfigListApiResp, error) {
	resp := &pb.QueryDynamicFunctionConfigListApiResp{}
	return resp, nil
}
