package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/course_learn/v1"
)

// GetTopicScoreByIds 知识点进度
func (c *CourseLearnV1CourseLearnUseCase) GetTopicScoreByIds(ctx context.Context, req *pb.GetTopicScoreByIdsRequest) (*pb.GetTopicScoreByIdsReply, error) {
	resp := &pb.GetTopicScoreByIdsReply{}
	return resp, nil
}
