package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// UserExamFinishNotice 用户诊疗完成同步
func (d *DiagnosisV1DiagnosisUseCase) UserExamFinishNotice(ctx context.Context, req *pb.UserExamFinishNoticeRequest) (*pb.ReplyEmpty, error) {
	resp := &pb.ReplyEmpty{}
	return resp, nil
}
