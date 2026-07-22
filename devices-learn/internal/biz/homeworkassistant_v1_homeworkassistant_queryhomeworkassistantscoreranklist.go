package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryHomeworkAssistantScoreRankList 作业助手排行榜-查询排行榜信息
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryHomeworkAssistantScoreRankList(ctx context.Context, req *pb.QueryHomeworkAssistantScoreRankListRequest) (*pb.QueryHomeworkAssistantScoreRankListReply, error) {
	resp := &pb.QueryHomeworkAssistantScoreRankListReply{}
	return resp, nil
}
