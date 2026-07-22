package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsOnionVersionListShadow 查询nps洋葱学园版本列表--shadow
func (n *NpsV1NpsUseCase) GetNpsOnionVersionListShadow(ctx context.Context, req *pb.GetNpsOnionVersionListRequest) (*pb.GetNpsOnionVersionListReply, error) {
	resp := &pb.GetNpsOnionVersionListReply{}
	return resp, nil
}
