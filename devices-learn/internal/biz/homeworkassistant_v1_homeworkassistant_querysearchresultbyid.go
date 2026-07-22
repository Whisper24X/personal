package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QuerySearchResultById 查询搜题结果
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QuerySearchResultById(ctx context.Context, req *pb.QuerySearchResultByIdRequest) (*pb.QuerySearchResultByIdReply, error) {
	resp := &pb.QuerySearchResultByIdReply{}
	return resp, nil
}
