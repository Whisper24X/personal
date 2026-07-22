package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsDeepUseUserListShadow 查询nps深度使用用户列表--shadow
func (n *NpsV1NpsUseCase) GetNpsDeepUseUserListShadow(ctx context.Context, req *pb.GetNpsDeepUseUserListRequest) (*pb.GetNpsDeepUseUserListReply, error) {
	resp := &pb.GetNpsDeepUseUserListReply{}
	return resp, nil
}
