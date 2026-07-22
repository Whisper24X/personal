package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsWordCloudShadow 查询nps词云--shadow
func (n *NpsV1NpsUseCase) GetNpsWordCloudShadow(ctx context.Context, req *pb.GetNpsWordCloudRequest) (*pb.GetNpsWordCloudReply, error) {
	resp := &pb.GetNpsWordCloudReply{}
	return resp, nil
}
