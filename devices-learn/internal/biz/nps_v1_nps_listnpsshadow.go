package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// ListNpsShadow 用户弹窗反馈列表--shadow
func (n *NpsV1NpsUseCase) ListNpsShadow(ctx context.Context, req *pb.ListNpsRequest) (*pb.ListNpsReply, error) {
	resp := &pb.ListNpsReply{}
	return resp, nil
}
