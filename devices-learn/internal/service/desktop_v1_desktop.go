package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/desktop/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewDesktopV1DesktopService(
	logger log.Logger,
	desktopV1DesktopUseCase *biz.DesktopV1DesktopUseCase,
) *DesktopV1DesktopService {
	l := log.NewHelper(log.With(logger, "module", "service/desktopV1Desktop"), log.WithMessageKey("message"))
	return &DesktopV1DesktopService{
		log:                     l,
		desktopV1DesktopUseCase: desktopV1DesktopUseCase,
	}
}

type DesktopV1DesktopService struct {
	pb.UnimplementedDesktopServer
	log                     *log.Helper
	desktopV1DesktopUseCase *biz.DesktopV1DesktopUseCase
}

// QueryDailyData 查询每日数据
func (d *DesktopV1DesktopService) QueryDailyData(ctx context.Context, req *pb.QueryDailyDataRequest) (*pb.QueryDailyDataReply, error) {
	return d.desktopV1DesktopUseCase.QueryDailyData(ctx, req)
}
