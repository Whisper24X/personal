package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1CourseService(
	logger log.Logger,
	wechatV1CourseUseCase *biz.WechatV1CourseUseCase,
) *WechatV1CourseService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1Course"), log.WithMessageKey("message"))
	return &WechatV1CourseService{
		log:                   l,
		wechatV1CourseUseCase: wechatV1CourseUseCase,
	}
}

type WechatV1CourseService struct {
	pb.UnimplementedCourseServer
	log                   *log.Helper
	wechatV1CourseUseCase *biz.WechatV1CourseUseCase
}

// GetCourseStockSelector 课程-通过课程查询可以预约的日期和时间段
func (w *WechatV1CourseService) GetCourseStockSelector(ctx context.Context, req *pb.GetCourseStockSelectorReq) (*pb.GetCourseStockSelectorReply, error) {
	return w.wechatV1CourseUseCase.GetCourseStockSelector(ctx, req)
}

// GetCourseAppointmentList 课程-查询课程预约记录
func (w *WechatV1CourseService) GetCourseAppointmentList(ctx context.Context, req *pb.GetCourseAppointmentListReq) (*pb.GetCourseAppointmentListReply, error) {
	return w.wechatV1CourseUseCase.GetCourseAppointmentList(ctx, req)
}

// CreateCourseAppointment 课程-预约
func (w *WechatV1CourseService) CreateCourseAppointment(ctx context.Context, req *pb.CreateCourseAppointmentReq) (*pb.CreateCourseAppointmentReply, error) {
	return w.wechatV1CourseUseCase.CreateCourseAppointment(ctx, req)
}

// UpdateCourseAppointment 课程-更新预约
func (w *WechatV1CourseService) UpdateCourseAppointment(ctx context.Context, req *pb.UpdateCourseAppointmentReq) (*pb.UpdateCourseAppointmentReply, error) {
	return w.wechatV1CourseUseCase.UpdateCourseAppointment(ctx, req)
}

// CancelCourseAppointment 课程-取消预约
func (w *WechatV1CourseService) CancelCourseAppointment(ctx context.Context, req *pb.CancelCourseAppointmentReq) (*pb.CancelCourseAppointmentReply, error) {
	return w.wechatV1CourseUseCase.CancelCourseAppointment(ctx, req)
}

// GetCourseAppointmentInfo 课程-查询课程预约记录信息
func (w *WechatV1CourseService) GetCourseAppointmentInfo(ctx context.Context, req *pb.GetCourseAppointmentInfoReq) (*pb.GetCourseAppointmentInfoReply, error) {
	return w.wechatV1CourseUseCase.GetCourseAppointmentInfo(ctx, req)
}

// GetGroupQrCodeByAppointmentId 通过预约ID查询群聊二维码
func (w *WechatV1CourseService) GetGroupQrCodeByAppointmentId(ctx context.Context, req *pb.GetGroupQrCodeByAppointmentIdReq) (*pb.GetGroupQrCodeByAppointmentIdReply, error) {
	return w.wechatV1CourseUseCase.GetGroupQrCodeByAppointmentId(ctx, req)
}
