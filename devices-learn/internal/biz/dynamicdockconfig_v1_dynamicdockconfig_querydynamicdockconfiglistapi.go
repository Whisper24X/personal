package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
)

// QueryDynamicDockConfigListApi 客户端查询动态dock配置列表
func (d *DynamicDockConfigV1DynamicDockConfigUseCase) QueryDynamicDockConfigListApi(ctx context.Context, req *pb.QueryDynamicDockConfigListApiReq) (*pb.QueryDynamicDockConfigListApiReply, error) {
	resp := &pb.QueryDynamicDockConfigListApiReply{}
	return resp, nil
}
