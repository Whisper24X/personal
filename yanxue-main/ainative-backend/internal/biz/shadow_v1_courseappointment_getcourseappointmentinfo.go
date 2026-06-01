package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCourseAppointmentInfo 课程-预约-单条数据查询
func (s *ShadowV1CourseAppointmentUseCase) GetCourseAppointmentInfo(ctx context.Context, req *pb.GetCourseAppointmentInfoReq) (*pb.GetCourseAppointmentInfoReply, error) {
	resp := &pb.GetCourseAppointmentInfoReply{
		Info: &pb.CourseAppointmentInfo{},
	}
	courseAppointment, err := s.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseAppointment == nil || courseAppointment.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, []string{courseAppointment.UpdatedBy})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseIdToName, err := s.courseRepo.CourseIdToName(ctx, []string{courseAppointment.CourseID})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	goodMap, err := s.goodRepo.GoodIdToName(ctx, []string{courseAppointment.GoodID})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseAppointmentInfo, err := s.courseAppointmentRepo.DTOShadowCourseAppointment(courseAppointment)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	courseAppointmentInfo.UpdatedBy = adminMap[courseAppointment.UpdatedBy]
	courseAppointmentInfo.CourseName = courseIdToName[courseAppointment.CourseID]
	courseAppointmentInfo.GoodName = goodMap[courseAppointment.GoodID]
	resp.Info = courseAppointmentInfo
	return resp, nil
}
