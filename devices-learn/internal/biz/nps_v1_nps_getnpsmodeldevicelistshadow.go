package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsModelDeviceListShadow 查询nps设备型号列表--shadow
func (n *NpsV1NpsUseCase) GetNpsModelDeviceListShadow(ctx context.Context, req *pb.GetNpsModelDeviceListRequest) (*pb.GetNpsModelDeviceListReply, error) {
	resp := &pb.GetNpsModelDeviceListReply{}
	return resp, nil
}
