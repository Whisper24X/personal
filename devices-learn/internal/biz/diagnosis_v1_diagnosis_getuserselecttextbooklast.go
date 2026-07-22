package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// GetUserSelectTextbookLast 用户最后一次选择的教材
func (d *DiagnosisV1DiagnosisUseCase) GetUserSelectTextbookLast(ctx context.Context, req *pb.GetUserSelectTextbookLastRequest) (*pb.GetUserSelectTextbookLastReply, error) {
	resp := &pb.GetUserSelectTextbookLastReply{}
	return resp, nil
}
