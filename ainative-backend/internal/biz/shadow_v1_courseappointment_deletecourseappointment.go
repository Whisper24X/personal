package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteCourseAppointment 课程-预约-删除多条数据
func (s *ShadowV1CourseAppointmentUseCase) DeleteCourseAppointment(ctx context.Context, req *pb.DeleteCourseAppointmentReq) (*pb.DeleteCourseAppointmentReply, error) {
	resp := &pb.DeleteCourseAppointmentReply{}
	err := s.courseAppointmentRepo.DeleteMultiCacheByIDS(ctx, req.GetIds())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
