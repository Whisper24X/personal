package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// UserSelectExamInfo 根据cvs选项获取当前所选教材试卷信息
func (d *DiagnosisV1DiagnosisUseCase) UserSelectExamInfo(ctx context.Context, req *pb.UserSelectExamInfoRequest) (*pb.UserSelectExamInfoReply, error) {
	resp := &pb.UserSelectExamInfoReply{}
	return resp, nil
}
