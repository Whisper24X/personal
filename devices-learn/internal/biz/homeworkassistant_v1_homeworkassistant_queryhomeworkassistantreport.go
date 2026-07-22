package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryHomeworkAssistantReport 查询作业助手报告
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryHomeworkAssistantReport(ctx context.Context, req *pb.QueryHomeworkAssistantReportRequest) (*pb.QueryHomeworkAssistantReportReply, error) {
	resp := &pb.QueryHomeworkAssistantReportReply{}
	return resp, nil
}
