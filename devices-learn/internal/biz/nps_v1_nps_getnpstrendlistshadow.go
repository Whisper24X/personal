package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetNpsTrendListShadow 查询nps走势图--shadow
func (n *NpsV1NpsUseCase) GetNpsTrendListShadow(ctx context.Context, req *pb.GetNpsTrendListRequest) (*pb.GetNpsTrendListReply, error) {
	resp := &pb.GetNpsTrendListReply{}
	return resp, nil
}
