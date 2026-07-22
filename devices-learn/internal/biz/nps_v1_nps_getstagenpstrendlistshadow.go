package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GetStageNpsTrendListShadow 查询nps学段走势图--shadow
func (n *NpsV1NpsUseCase) GetStageNpsTrendListShadow(ctx context.Context, req *pb.GetStageNpsTrendListRequest) (*pb.GetStageNpsTrendListReply, error) {
	resp := &pb.GetStageNpsTrendListReply{}
	return resp, nil
}
