package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteCourse 课程-信息-删除多条数据
func (s *ShadowV1CourseUseCase) DeleteCourse(ctx context.Context, req *pb.DeleteCourseReq) (*pb.DeleteCourseReply, error) {
	resp := &pb.DeleteCourseReply{}
	err := s.courseRepo.DeleteMultiCacheByIDS(ctx, req.GetIds())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
