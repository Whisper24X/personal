package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// DiagnosisSchoolYearList 查询当前支持的全部年级
func (d *DiagnosisV1DiagnosisUseCase) DiagnosisSchoolYearList(ctx context.Context, req *pb.DiagnosisSchoolYearListRequest) (*pb.DiagnosisSchoolYearListReply, error) {
	resp := &pb.DiagnosisSchoolYearListReply{}
	return resp, nil
}
