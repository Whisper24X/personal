package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// UserSelectTextbookReport 用户选择的教材上报
func (d *DiagnosisV1DiagnosisUseCase) UserSelectTextbookReport(ctx context.Context, req *pb.UserSelectTextbookReportRequest) (*pb.ReplyEmpty, error) {
	resp := &pb.ReplyEmpty{}
	return resp, nil
}
