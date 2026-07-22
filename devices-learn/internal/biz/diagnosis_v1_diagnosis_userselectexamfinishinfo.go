package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// UserSelectExamFinishInfo 用户当前所选教材完成情况
func (d *DiagnosisV1DiagnosisUseCase) UserSelectExamFinishInfo(ctx context.Context, req *pb.UserSelectExamFinishInfoRequest) (*pb.UserSelectExamFinishInfoReply, error) {
	resp := &pb.UserSelectExamFinishInfoReply{}
	return resp, nil
}
