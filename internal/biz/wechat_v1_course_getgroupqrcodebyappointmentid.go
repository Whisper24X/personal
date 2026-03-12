package biz

import (
	"context"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
)

// GetGroupQrCodeByAppointmentId 通过预约ID查询群聊二维码
func (w *WechatV1CourseUseCase) GetGroupQrCodeByAppointmentId(ctx context.Context, req *pb.GetGroupQrCodeByAppointmentIdReq) (*pb.GetGroupQrCodeByAppointmentIdReply, error) {
	resp := &pb.GetGroupQrCodeByAppointmentIdReply{}
	courseAppointment, err := w.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetAppointmentId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseAppointment == nil || courseAppointment.CourseID == "" {
		return resp, nil
	}
	courseId := courseAppointment.CourseID
	date := courseAppointment.Date
	period := courseAppointment.Period
	//查询群聊二维码
	courseStock, err := w.courseStockRepo.FindOneCacheByCourseIDDatePeriod(ctx, courseId, date, period)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseStock == nil || courseStock.GroupQrCode == "" {
		return resp, nil
	}
	resp.GroupQrCode = courseStock.GroupQrCode
	return resp, nil
}
