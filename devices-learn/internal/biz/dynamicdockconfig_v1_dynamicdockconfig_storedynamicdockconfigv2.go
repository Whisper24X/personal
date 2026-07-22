package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
)

// StoreDynamicDockConfigV2 保存动态dock配置(v2)
func (d *DynamicDockConfigV1DynamicDockConfigUseCase) StoreDynamicDockConfigV2(ctx context.Context, req *pb.StoreDynamicDockConfigReq) (*pb.StoreDynamicDockConfigReply, error) {
	resp := &pb.StoreDynamicDockConfigReply{}
	return resp, nil
}
