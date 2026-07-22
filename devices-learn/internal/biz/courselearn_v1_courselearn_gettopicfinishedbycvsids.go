package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/course_learn/v1"
)

// GetTopicFinishedByCvsIds cvs册下知识点完成情况
func (c *CourseLearnV1CourseLearnUseCase) GetTopicFinishedByCvsIds(ctx context.Context, req *pb.GetTopicFinishedByCvsIdsRequest) (*pb.GetTopicFinishedByCvsIdsReply, error) {
	resp := &pb.GetTopicFinishedByCvsIdsReply{}
	return resp, nil
}
