package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// GetTextbookIdsBySchoolYear 根据学科学段年级获取教材信息
func (d *DiagnosisV1DiagnosisUseCase) GetTextbookIdsBySchoolYear(ctx context.Context, req *pb.GetTextbookIdsBySchoolYearRequest) (*pb.GetTextbookIdsBySchoolYearReply, error) {
	resp := &pb.GetTextbookIdsBySchoolYearReply{}
	return resp, nil
}
