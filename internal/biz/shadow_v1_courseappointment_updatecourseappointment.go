package biz

import (
	"context"
	"strings"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// UpdateCourseAppointment 课程-预约-更新一条数据
func (s *ShadowV1CourseAppointmentUseCase) UpdateCourseAppointment(ctx context.Context, req *pb.UpdateCourseAppointmentReq) (*pb.UpdateCourseAppointmentReply, error) {
	resp := &pb.UpdateCourseAppointmentReply{}
	periods := strings.Split(req.GetPeriod(), "-")
	periodStartTime := ""
	periodEndTime := ""
	if len(periods) == 2 {
		periodStartTime = periods[0]
		periodEndTime = periods[1]
	}
	adminId := meta.GetAdminID(ctx)
	courseAppointment, err := s.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseAppointment == nil || courseAppointment.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	// 只能更新已预约状态
	if courseAppointment.Status != constant.CourseAppointmentStatusSuccess.String() {
		return nil, errorx.CourseAppointmentStatusNotAllowed.Err()
	}
	oldCourseAppointment := s.courseAppointmentRepo.DeepCopy(courseAppointment)
	studentIC := ""
	if req.GetStudentIdentityCard() != "" {
		studentIC, err = cryptutil.YcCardEncrypt(req.GetStudentIdentityCard())
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	parentPh, err := cryptutil.YcPhoneEncrypt(req.GetParentPhone())
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	courseAppointment.Date = req.GetDate()
	courseAppointment.Period = req.GetPeriod()
	courseAppointment.PeriodStartTime = periodStartTime
	courseAppointment.PeriodEndTime = periodEndTime
	courseAppointment.StudentName = req.GetStudentName()
	courseAppointment.StudentIC = studentIC
	courseAppointment.StudentSex = req.GetStudentSex()
	courseAppointment.StudentAge = int16(req.GetStudentAge())
	courseAppointment.ParentName = req.GetParentName()
	courseAppointment.ParentPh = parentPh
	courseAppointment.ParentAccompany = req.GetParentAccompany()
	courseAppointment.UpdatedBy = adminId
	courseAppointment.BusinessRemark = req.GetBusinessRemark()
	err = s.courseAppointmentRepo.UpdateOneCacheWithZero(ctx, courseAppointment, oldCourseAppointment)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
