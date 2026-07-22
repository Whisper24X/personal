package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsNewOldUserListShadow 查询nps新老用户列表--shadow
func (n *NpsV1NpsUseCase) GetNpsNewOldUserListShadow(ctx context.Context, req *pb.GetNpsNewOldUserListRequest) (*pb.GetNpsNewOldUserListReply, error) {
	resp := &pb.GetNpsNewOldUserListReply{}
	return resp, nil
}
