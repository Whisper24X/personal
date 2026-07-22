package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// UserSelectExamRedo 用户所选试卷重做
func (d *DiagnosisV1DiagnosisUseCase) UserSelectExamRedo(ctx context.Context, req *pb.UserSelectExamRedoRequest) (*pb.ReplyEmpty, error) {
	resp := &pb.ReplyEmpty{}
	return resp, nil
}
