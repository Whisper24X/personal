package biz

import (
	"context"

	"github.com/spf13/cast"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetCourseAppointmentInfo 课程-查询课程预约记录信息
func (w *WechatV1CourseUseCase) GetCourseAppointmentInfo(ctx context.Context, req *pb.GetCourseAppointmentInfoReq) (*pb.GetCourseAppointmentInfoReply, error) {
	resp := &pb.GetCourseAppointmentInfoReply{
		Info: &pb.CourseAppointmentInfo{},
	}
	courseAppointment, err := w.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseAppointment == nil || courseAppointment.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	goodIdToName, err := w.goodRepo.GoodIdToName(ctx, []string{courseAppointment.GoodID})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseIdToName, err := w.courseRepo.CourseIdToName(ctx, []string{courseAppointment.CourseID})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	studentIdentityCard := ""
	if courseAppointment.StudentIC != "" {
		studentIdentityCard, err = cryptutil.YcCardDecrypt(courseAppointment.StudentIC)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	parentPhone, err := cryptutil.YcPhoneDecrypt(courseAppointment.ParentPh)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	courseStock, err := w.courseStockRepo.FindOneByCourseIDDatePeriod(ctx, courseAppointment.CourseID, courseAppointment.Date, courseAppointment.Period)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Info = &pb.CourseAppointmentInfo{
		Id:                  courseAppointment.ID,
		OrderId:             courseAppointment.OrderID,
		GoodId:              courseAppointment.GoodID,
		CategoryId:          courseAppointment.CategoryID,
		CourseId:            courseAppointment.CourseID,
		Date:                courseAppointment.Date,
		Period:              courseAppointment.Period,
		StudentName:         courseAppointment.StudentName,
		StudentIdentityCard: studentIdentityCard,
		StudentSex:          courseAppointment.StudentSex,
		StudentAge:          cast.ToInt32(courseAppointment.StudentAge),
		ParentName:          courseAppointment.ParentName,
		ParentPhone:         parentPhone,
		ParentAccompany:     courseAppointment.ParentAccompany,
		VerificationCode:    courseAppointment.VerificationCode,
		Status:              courseAppointment.Status,
		CreatedAt:           timeutil.RFC3339(courseAppointment.CreatedAt),
		UpdatedAt:           timeutil.RFC3339(courseAppointment.UpdatedAt),
		GoodName:            goodIdToName[courseAppointment.GoodID],
		CourseName:          courseIdToName[courseAppointment.CourseID],
		ParentRemark:        courseAppointment.ParentRemark,
		CourseType:          courseStock.CourseType,
		GroupQrCode:         courseStock.GroupQrCode,
	}
	return resp, nil
}
