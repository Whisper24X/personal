package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewNpsV1NpsService(
	logger log.Logger,
	npsV1NpsUseCase *biz.NpsV1NpsUseCase,
) *NpsV1NpsService {
	l := log.NewHelper(log.With(logger, "module", "service/npsV1Nps"), log.WithMessageKey("message"))
	return &NpsV1NpsService{
		log:             l,
		npsV1NpsUseCase: npsV1NpsUseCase,
	}
}

type NpsV1NpsService struct {
	pb.UnimplementedNpsServer
	log             *log.Helper
	npsV1NpsUseCase *biz.NpsV1NpsUseCase
}

// GetNpsPopup 获取用户弹窗信息
func (n *NpsV1NpsService) GetNpsPopup(ctx context.Context, req *pb.GetNpsPopupRequest) (*pb.GetNpsPopupReply, error) {
	return n.npsV1NpsUseCase.GetNpsPopup(ctx, req)
}

// SubmitNpsAnswer 用户弹窗答案提交
func (n *NpsV1NpsService) SubmitNpsAnswer(ctx context.Context, req *pb.SubmitNpsAnswerRequest) (*pb.SubmitNpsAnswerReply, error) {
	return n.npsV1NpsUseCase.SubmitNpsAnswer(ctx, req)
}

// ListNpsShadow 用户弹窗反馈列表--shadow
func (n *NpsV1NpsService) ListNpsShadow(ctx context.Context, req *pb.ListNpsRequest) (*pb.ListNpsReply, error) {
	return n.npsV1NpsUseCase.ListNpsShadow(ctx, req)
}

// GetNpsTrendListShadow 查询nps走势图--shadow
func (n *NpsV1NpsService) GetNpsTrendListShadow(ctx context.Context, req *pb.GetNpsTrendListRequest) (*pb.GetNpsTrendListReply, error) {
	return n.npsV1NpsUseCase.GetNpsTrendListShadow(ctx, req)
}

// GetStageNpsTrendListShadow 查询nps学段走势图--shadow
func (n *NpsV1NpsService) GetStageNpsTrendListShadow(ctx context.Context, req *pb.GetStageNpsTrendListRequest) (*pb.GetStageNpsTrendListReply, error) {
	return n.npsV1NpsUseCase.GetStageNpsTrendListShadow(ctx, req)
}

// GetNpsWordCloudShadow 查询nps词云--shadow
func (n *NpsV1NpsService) GetNpsWordCloudShadow(ctx context.Context, req *pb.GetNpsWordCloudRequest) (*pb.GetNpsWordCloudReply, error) {
	return n.npsV1NpsUseCase.GetNpsWordCloudShadow(ctx, req)
}

// GetNpsNewOldUserListShadow 查询nps新老用户列表--shadow
func (n *NpsV1NpsService) GetNpsNewOldUserListShadow(ctx context.Context, req *pb.GetNpsNewOldUserListRequest) (*pb.GetNpsNewOldUserListReply, error) {
	return n.npsV1NpsUseCase.GetNpsNewOldUserListShadow(ctx, req)
}

// GetNpsDeepUseUserListShadow 查询nps深度使用用户列表--shadow
func (n *NpsV1NpsService) GetNpsDeepUseUserListShadow(ctx context.Context, req *pb.GetNpsDeepUseUserListRequest) (*pb.GetNpsDeepUseUserListReply, error) {
	return n.npsV1NpsUseCase.GetNpsDeepUseUserListShadow(ctx, req)
}

// GetNpsModelDeviceListShadow 查询nps设备型号列表--shadow
func (n *NpsV1NpsService) GetNpsModelDeviceListShadow(ctx context.Context, req *pb.GetNpsModelDeviceListRequest) (*pb.GetNpsModelDeviceListReply, error) {
	return n.npsV1NpsUseCase.GetNpsModelDeviceListShadow(ctx, req)
}

// GetNpsOnionVersionListShadow 查询nps洋葱学园版本列表--shadow
func (n *NpsV1NpsService) GetNpsOnionVersionListShadow(ctx context.Context, req *pb.GetNpsOnionVersionListRequest) (*pb.GetNpsOnionVersionListReply, error) {
	return n.npsV1NpsUseCase.GetNpsOnionVersionListShadow(ctx, req)
}

// GetNpsDesktopVersionListShadow 查询nps桌面版本列表--shadow
func (n *NpsV1NpsService) GetNpsDesktopVersionListShadow(ctx context.Context, req *pb.GetNpsDesktopVersionListRequest) (*pb.GetNpsDesktopVersionListReply, error) {
	return n.npsV1NpsUseCase.GetNpsDesktopVersionListShadow(ctx, req)
}

// GenerateNpsSummaryShadow 生成nps汇总数据--shadow
func (n *NpsV1NpsService) GenerateNpsSummaryShadow(ctx context.Context, req *pb.GenerateNpsSummaryRequest) (*pb.GenerateNpsSummaryReply, error) {
	return n.npsV1NpsUseCase.GenerateNpsSummaryShadow(ctx, req)
}
