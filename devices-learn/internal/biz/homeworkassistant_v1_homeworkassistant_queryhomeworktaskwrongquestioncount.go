package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryHomeworkTaskWrongQuestionCount 查询作业任务所属错题数量
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryHomeworkTaskWrongQuestionCount(ctx context.Context, req *pb.QueryHomeworkTaskWrongQuestionCountRequest) (*pb.QueryHomeworkTaskWrongQuestionCountReply, error) {
	resp := &pb.QueryHomeworkTaskWrongQuestionCountReply{}
	return resp, nil
}
