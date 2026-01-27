package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1CourseStockService(
	logger log.Logger,
	shadowV1CourseStockUseCase *biz.ShadowV1CourseStockUseCase,
) *ShadowV1CourseStockService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1CourseStock"), log.WithMessageKey("message"))
	return &ShadowV1CourseStockService{
		log:                        l,
		shadowV1CourseStockUseCase: shadowV1CourseStockUseCase,
	}
}

type ShadowV1CourseStockService struct {
	pb.UnimplementedCourseStockServer
	log                        *log.Helper
	shadowV1CourseStockUseCase *biz.ShadowV1CourseStockUseCase
}

// CreateCourseStock -创建一条数据
func (s *ShadowV1CourseStockService) CreateCourseStock(ctx context.Context, req *pb.CreateCourseStockReq) (*pb.CreateCourseStockReply, error) {
	return s.shadowV1CourseStockUseCase.CreateCourseStock(ctx, req)
}

// UpdateCourseStock -更新一条数据
func (s *ShadowV1CourseStockService) UpdateCourseStock(ctx context.Context, req *pb.UpdateCourseStockReq) (*pb.UpdateCourseStockReply, error) {
	return s.shadowV1CourseStockUseCase.UpdateCourseStock(ctx, req)
}

// DeleteCourseStock -删除多条数据
func (s *ShadowV1CourseStockService) DeleteCourseStock(ctx context.Context, req *pb.DeleteCourseStockReq) (*pb.DeleteCourseStockReply, error) {
	return s.shadowV1CourseStockUseCase.DeleteCourseStock(ctx, req)
}

// GetCourseStockInfo -单条数据查询
func (s *ShadowV1CourseStockService) GetCourseStockInfo(ctx context.Context, req *pb.GetCourseStockInfoReq) (*pb.GetCourseStockInfoReply, error) {
	return s.shadowV1CourseStockUseCase.GetCourseStockInfo(ctx, req)
}

// GetCourseStockList -列表数据查询
func (s *ShadowV1CourseStockService) GetCourseStockList(ctx context.Context, req *pb.GetCourseStockListReq) (*pb.GetCourseStockListReply, error) {
	return s.shadowV1CourseStockUseCase.GetCourseStockList(ctx, req)
}

// UpdateCourseStockStatus 课程库存-更新一条数据状态
func (s *ShadowV1CourseStockService) UpdateCourseStockStatus(ctx context.Context, req *pb.UpdateCourseStockStatusReq) (*pb.UpdateCourseStockStatusReply, error) {
	return s.shadowV1CourseStockUseCase.UpdateCourseStockStatus(ctx, req)
}

// GetCourseStockSelector 课程库存-通过课程查询可以预约的日期和时间段
func (s *ShadowV1CourseStockService) GetCourseStockSelector(ctx context.Context, req *pb.GetCourseStockSelectorReq) (*pb.GetCourseStockSelectorReply, error) {
	return s.shadowV1CourseStockUseCase.GetCourseStockSelector(ctx, req)
}

// UpdateCourseStockGroupQrCode 课程库存-更新群聊二维码
func (s *ShadowV1CourseStockService) UpdateCourseStockGroupQrCode(ctx context.Context, req *pb.UpdateCourseStockGroupQrCodeReq) (*pb.UpdateCourseStockGroupQrCodeReply, error) {
	return s.shadowV1CourseStockUseCase.UpdateCourseStockGroupQrCode(ctx, req)
}
