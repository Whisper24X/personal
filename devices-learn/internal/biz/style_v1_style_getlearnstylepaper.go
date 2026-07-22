package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/style/v1"
)

// GetLearnStylePaper 获取学习风格问卷
func (s *StyleV1StyleUseCase) GetLearnStylePaper(ctx context.Context, req *pb.GetLearnStylePaperRequest) (*pb.GetLearnStylePaperReply, error) {
	resp := &pb.GetLearnStylePaperReply{}
	return resp, nil
}
