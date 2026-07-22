package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsPopup 获取用户弹窗信息
func (n *NpsV1NpsUseCase) GetNpsPopup(ctx context.Context, req *pb.GetNpsPopupRequest) (*pb.GetNpsPopupReply, error) {
	resp := &pb.GetNpsPopupReply{}
	return resp, nil
}
