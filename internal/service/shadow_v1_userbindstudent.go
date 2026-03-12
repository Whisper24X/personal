package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1UserBindStudentService(
	logger log.Logger,
	shadowV1UserBindStudentUseCase *biz.ShadowV1UserBindStudentUseCase,
) *ShadowV1UserBindStudentService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1UserBindStudent"), log.WithMessageKey("message"))
	return &ShadowV1UserBindStudentService{
		log:                            l,
		shadowV1UserBindStudentUseCase: shadowV1UserBindStudentUseCase,
	}
}

type ShadowV1UserBindStudentService struct {
	pb.UnimplementedUserBindStudentServer
	log                            *log.Helper
	shadowV1UserBindStudentUseCase *biz.ShadowV1UserBindStudentUseCase
}

// CreateUserBindStudent 用户绑定学生-创建一条数据
func (s *ShadowV1UserBindStudentService) CreateUserBindStudent(ctx context.Context, req *pb.CreateUserBindStudentReq) (*pb.CreateUserBindStudentReply, error) {
	return s.shadowV1UserBindStudentUseCase.CreateUserBindStudent(ctx, req)
}

// UpdateUserBindStudent 用户绑定学生-更新一条数据
func (s *ShadowV1UserBindStudentService) UpdateUserBindStudent(ctx context.Context, req *pb.UpdateUserBindStudentReq) (*pb.UpdateUserBindStudentReply, error) {
	return s.shadowV1UserBindStudentUseCase.UpdateUserBindStudent(ctx, req)
}

// DeleteUserBindStudent 用户绑定学生-删除多条数据
func (s *ShadowV1UserBindStudentService) DeleteUserBindStudent(ctx context.Context, req *pb.DeleteUserBindStudentReq) (*pb.DeleteUserBindStudentReply, error) {
	return s.shadowV1UserBindStudentUseCase.DeleteUserBindStudent(ctx, req)
}

// GetUserBindStudentInfo 用户绑定学生-单条数据查询
func (s *ShadowV1UserBindStudentService) GetUserBindStudentInfo(ctx context.Context, req *pb.GetUserBindStudentInfoReq) (*pb.GetUserBindStudentInfoReply, error) {
	return s.shadowV1UserBindStudentUseCase.GetUserBindStudentInfo(ctx, req)
}

// GetUserBindStudentList 用户绑定学生-列表数据查询
func (s *ShadowV1UserBindStudentService) GetUserBindStudentList(ctx context.Context, req *pb.GetUserBindStudentListReq) (*pb.GetUserBindStudentListReply, error) {
	return s.shadowV1UserBindStudentUseCase.GetUserBindStudentList(ctx, req)
}
