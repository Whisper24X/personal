package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// StoreHomeworkAssistantTaskScore 作业助手积分-任务完成
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) StoreHomeworkAssistantTaskScore(ctx context.Context, req *pb.StoreHomeworkAssistantTaskScoreRequest) (*pb.StoreHomeworkAssistantTaskScoreReply, error) {
	resp := &pb.StoreHomeworkAssistantTaskScoreReply{}
	return resp, nil
}
