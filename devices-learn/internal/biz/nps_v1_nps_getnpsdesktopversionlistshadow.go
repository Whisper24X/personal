package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsDesktopVersionListShadow 查询nps桌面版本列表--shadow
func (n *NpsV1NpsUseCase) GetNpsDesktopVersionListShadow(ctx context.Context, req *pb.GetNpsDesktopVersionListRequest) (*pb.GetNpsDesktopVersionListReply, error) {
	resp := &pb.GetNpsDesktopVersionListReply{}
	return resp, nil
}
