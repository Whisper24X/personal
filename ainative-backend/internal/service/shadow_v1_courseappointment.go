package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1CourseAppointmentService(
	logger log.Logger,
	shadowV1CourseAppointmentUseCase *biz.ShadowV1CourseAppointmentUseCase,
) *ShadowV1CourseAppointmentService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1CourseAppointment"), log.WithMessageKey("message"))
	return &ShadowV1CourseAppointmentService{
		log:                              l,
		shadowV1CourseAppointmentUseCase: shadowV1CourseAppointmentUseCase,
	}
}

type ShadowV1CourseAppointmentService struct {
	pb.UnimplementedCourseAppointmentServer
	log                              *log.Helper
	shadowV1CourseAppointmentUseCase *biz.ShadowV1CourseAppointmentUseCase
}

// UpdateCourseAppointment 课程-预约-更新一条数据
func (s *ShadowV1CourseAppointmentService) UpdateCourseAppointment(ctx context.Context, req *pb.UpdateCourseAppointmentReq) (*pb.UpdateCourseAppointmentReply, error) {
	return s.shadowV1CourseAppointmentUseCase.UpdateCourseAppointment(ctx, req)
}

// CancelCourseAppointment 课程-预约-取消预约
func (s *ShadowV1CourseAppointmentService) CancelCourseAppointment(ctx context.Context, req *pb.CancelCourseAppointmentReq) (*pb.CancelCourseAppointmentReply, error) {
	return s.shadowV1CourseAppointmentUseCase.CancelCourseAppointment(ctx, req)
}

// DeleteCourseAppointment 课程-预约-删除多条数据
func (s *ShadowV1CourseAppointmentService) DeleteCourseAppointment(ctx context.Context, req *pb.DeleteCourseAppointmentReq) (*pb.DeleteCourseAppointmentReply, error) {
	return s.shadowV1CourseAppointmentUseCase.DeleteCourseAppointment(ctx, req)
}

// GetCourseAppointmentInfo 课程-预约-单条数据查询
func (s *ShadowV1CourseAppointmentService) GetCourseAppointmentInfo(ctx context.Context, req *pb.GetCourseAppointmentInfoReq) (*pb.GetCourseAppointmentInfoReply, error) {
	return s.shadowV1CourseAppointmentUseCase.GetCourseAppointmentInfo(ctx, req)
}

// GetCourseAppointmentList 课程-预约-列表数据查询
func (s *ShadowV1CourseAppointmentService) GetCourseAppointmentList(ctx context.Context, req *pb.GetCourseAppointmentListReq) (*pb.GetCourseAppointmentListReply, error) {
	return s.shadowV1CourseAppointmentUseCase.GetCourseAppointmentList(ctx, req)
}

// FinishCourseAppointment 课程-预约-完成脚本
func (s *ShadowV1CourseAppointmentService) FinishCourseAppointment(ctx context.Context, req *pb.FinishCourseAppointmentReq) (*pb.FinishCourseAppointmentReply, error) {
	return s.shadowV1CourseAppointmentUseCase.FinishCourseAppointment(ctx, req)
}

// ExportCourseAppointmentList 课程-预约-列表数据导出
func (s *ShadowV1CourseAppointmentService) ExportCourseAppointmentList(ctx context.Context, req *pb.ExportCourseAppointmentListReq) (*pb.ExportCourseAppointmentListReply, error) {
	return s.shadowV1CourseAppointmentUseCase.ExportCourseAppointmentList(ctx, req)
}

// GetContractFieldInfo 获取合同字段信息
func (s *ShadowV1CourseAppointmentService) GetContractFieldInfo(ctx context.Context, req *pb.GetContractFieldInfoReq) (*pb.GetContractFieldInfoReply, error) {
	return s.shadowV1CourseAppointmentUseCase.GetContractFieldInfo(ctx, req)
}

// CreateCourseAppointment 课程-预约
func (s *ShadowV1CourseAppointmentService) CreateCourseAppointment(ctx context.Context, req *pb.CreateCourseAppointmentReq) (*pb.CreateCourseAppointmentReply, error) {
	return s.shadowV1CourseAppointmentUseCase.CreateCourseAppointment(ctx, req)
}

// FeiShuReportAppointmentSituation 飞书通知预约情况
func (s *ShadowV1CourseAppointmentService) FeiShuReportAppointmentSituation(ctx context.Context, req *pb.FeiShuReportAppointmentSituationReq) (*pb.FeiShuReportAppointmentSituationReply, error) {
	return s.shadowV1CourseAppointmentUseCase.FeiShuReportAppointmentSituation(ctx, req)
}

// SendAppointmentReminderSms 发送预约提醒短信（定时任务用）
func (s *ShadowV1CourseAppointmentService) SendAppointmentReminderSms(ctx context.Context) (*biz.SendAppointmentReminderSmsReply, error) {
	return s.shadowV1CourseAppointmentUseCase.SendAppointmentReminderSms(ctx)
}
