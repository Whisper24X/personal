package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// GenerateRankList 作业助手排行榜-根据DB数据生成排行榜
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) GenerateRankList(ctx context.Context, req *pb.GenerateRankListRequest) (*pb.GenerateRankListReply, error) {
	resp := &pb.GenerateRankListReply{}
	return resp, nil
}
