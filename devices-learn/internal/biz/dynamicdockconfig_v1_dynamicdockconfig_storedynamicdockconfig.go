package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
)

// StoreDynamicDockConfig 保存动态dock配置
func (d *DynamicDockConfigV1DynamicDockConfigUseCase) StoreDynamicDockConfig(ctx context.Context, req *pb.StoreDynamicDockConfigReq) (*pb.StoreDynamicDockConfigReply, error) {
	resp := &pb.StoreDynamicDockConfigReply{}
	return resp, nil
}
