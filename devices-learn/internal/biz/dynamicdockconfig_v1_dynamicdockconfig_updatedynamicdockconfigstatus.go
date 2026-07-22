package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
)

// UpdateDynamicDockConfigStatus 修改动态dock配置状态
func (d *DynamicDockConfigV1DynamicDockConfigUseCase) UpdateDynamicDockConfigStatus(ctx context.Context, req *pb.UpdateDynamicDockConfigStatusReq) (*pb.UpdateDynamicDockConfigStatusReply, error) {
	resp := &pb.UpdateDynamicDockConfigStatusReply{}
	return resp, nil
}
