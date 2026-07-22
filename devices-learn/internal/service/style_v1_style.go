package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/style/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewStyleV1StyleService(
	logger log.Logger,
	styleV1StyleUseCase *biz.StyleV1StyleUseCase,
) *StyleV1StyleService {
	l := log.NewHelper(log.With(logger, "module", "service/styleV1Style"), log.WithMessageKey("message"))
	return &StyleV1StyleService{
		log:                 l,
		styleV1StyleUseCase: styleV1StyleUseCase,
	}
}

type StyleV1StyleService struct {
	pb.UnimplementedStyleServer
	log                 *log.Helper
	styleV1StyleUseCase *biz.StyleV1StyleUseCase
}

// GetLearnStylePaper 获取学习风格问卷
func (s *StyleV1StyleService) GetLearnStylePaper(ctx context.Context, req *pb.GetLearnStylePaperRequest) (*pb.GetLearnStylePaperReply, error) {
	return s.styleV1StyleUseCase.GetLearnStylePaper(ctx, req)
}

// CreateUserStyle 创建用户学习风格
func (s *StyleV1StyleService) CreateUserStyle(ctx context.Context, req *pb.CreateUserStyleRequest) (*pb.UserStyleInfo, error) {
	return s.styleV1StyleUseCase.CreateUserStyle(ctx, req)
}

// GetUserStyle 查询用户学习风格
func (s *StyleV1StyleService) GetUserStyle(ctx context.Context, req *pb.GetUserStyleRequest) (*pb.UserStyleInfo, error) {
	return s.styleV1StyleUseCase.GetUserStyle(ctx, req)
}
