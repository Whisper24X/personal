package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// UserExamResultReport 用户所选教材对应的试卷结果报告
func (d *DiagnosisV1DiagnosisUseCase) UserExamResultReport(ctx context.Context, req *pb.UserExamResultReportRequest) (*pb.UserExamResultReportReply, error) {
	resp := &pb.UserExamResultReportReply{}
	return resp, nil
}
