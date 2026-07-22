package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
)

// DiagnosisCvsList 可选择教材cvs列表
func (d *DiagnosisV1DiagnosisUseCase) DiagnosisCvsList(ctx context.Context, req *pb.DiagnosisCvsListRequest) (*pb.DiagnosisCvsListReply, error) {
	resp := &pb.DiagnosisCvsListReply{}
	return resp, nil
}
