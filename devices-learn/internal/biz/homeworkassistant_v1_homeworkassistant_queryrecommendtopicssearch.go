package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryRecommendTopicsSearch 查询知识点名称推荐视频
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryRecommendTopicsSearch(ctx context.Context, req *pb.TopicSearchRequest) (*pb.TopicSearchReply, error) {
	resp := &pb.TopicSearchReply{}
	return resp, nil
}
