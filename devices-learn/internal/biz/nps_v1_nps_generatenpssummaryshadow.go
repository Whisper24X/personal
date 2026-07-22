package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// GenerateNpsSummaryShadow 生成nps汇总数据--shadow
func (n *NpsV1NpsUseCase) GenerateNpsSummaryShadow(ctx context.Context, req *pb.GenerateNpsSummaryRequest) (*pb.GenerateNpsSummaryReply, error) {
	resp := &pb.GenerateNpsSummaryReply{}
	return resp, nil
}
