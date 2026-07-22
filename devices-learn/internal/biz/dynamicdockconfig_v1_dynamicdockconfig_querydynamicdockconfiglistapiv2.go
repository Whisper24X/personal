package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
)

// QueryDynamicDockConfigListApiV2 客户端查询动态dock配置列表(v2)
func (d *DynamicDockConfigV1DynamicDockConfigUseCase) QueryDynamicDockConfigListApiV2(ctx context.Context, req *pb.QueryDynamicDockConfigListApiReq) (*pb.QueryDynamicDockConfigListApiReply, error) {
	resp := &pb.QueryDynamicDockConfigListApiReply{}
	return resp, nil
}
