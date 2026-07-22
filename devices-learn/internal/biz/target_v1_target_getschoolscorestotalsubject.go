package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/target/v1"
)

// GetSchoolScoresTotalSubject 查询学校各科满分分数选项
func (t *TargetV1TargetUseCase) GetSchoolScoresTotalSubject(ctx context.Context, req *pb.GetSchoolScoresTotalSubjectRequest) (*pb.GetSchoolScoresTotalSubjectReply, error) {
	resp := &pb.GetSchoolScoresTotalSubjectReply{}
	return resp, nil
}
