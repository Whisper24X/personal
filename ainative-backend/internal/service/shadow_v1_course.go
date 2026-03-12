package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1CourseService(
	logger log.Logger,
	shadowV1CourseUseCase *biz.ShadowV1CourseUseCase,
) *ShadowV1CourseService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Course"), log.WithMessageKey("message"))
	return &ShadowV1CourseService{
		log:                   l,
		shadowV1CourseUseCase: shadowV1CourseUseCase,
	}
}

type ShadowV1CourseService struct {
	pb.UnimplementedCourseServer
	log                   *log.Helper
	shadowV1CourseUseCase *biz.ShadowV1CourseUseCase
}

// CreateCourse 课程-信息-创建一条数据
func (s *ShadowV1CourseService) CreateCourse(ctx context.Context, req *pb.CreateCourseReq) (*pb.CreateCourseReply, error) {
	return s.shadowV1CourseUseCase.CreateCourse(ctx, req)
}

// UpdateCourse 课程-信息-更新一条数据
func (s *ShadowV1CourseService) UpdateCourse(ctx context.Context, req *pb.UpdateCourseReq) (*pb.UpdateCourseReply, error) {
	return s.shadowV1CourseUseCase.UpdateCourse(ctx, req)
}

// DeleteCourse 课程-信息-删除多条数据
func (s *ShadowV1CourseService) DeleteCourse(ctx context.Context, req *pb.DeleteCourseReq) (*pb.DeleteCourseReply, error) {
	return s.shadowV1CourseUseCase.DeleteCourse(ctx, req)
}

// GetCourseInfo 课程-信息-单条数据查询
func (s *ShadowV1CourseService) GetCourseInfo(ctx context.Context, req *pb.GetCourseInfoReq) (*pb.GetCourseInfoReply, error) {
	return s.shadowV1CourseUseCase.GetCourseInfo(ctx, req)
}

// GetCourseList 课程-信息-列表数据查询
func (s *ShadowV1CourseService) GetCourseList(ctx context.Context, req *pb.GetCourseListReq) (*pb.GetCourseListReply, error) {
	return s.shadowV1CourseUseCase.GetCourseList(ctx, req)
}

// UpdateCourseStatus 课程-信息-更新状态
func (s *ShadowV1CourseService) UpdateCourseStatus(ctx context.Context, req *pb.UpdateCourseStatusReq) (*pb.UpdateCourseStatusReply, error) {
	return s.shadowV1CourseUseCase.UpdateCourseStatus(ctx, req)
}

// GetCourseSelector 课程-信息-选择器
func (s *ShadowV1CourseService) GetCourseSelector(ctx context.Context, req *pb.GetCourseSelectorReq) (*pb.GetCourseSelectorReply, error) {
	return s.shadowV1CourseUseCase.GetCourseSelector(ctx, req)
}
