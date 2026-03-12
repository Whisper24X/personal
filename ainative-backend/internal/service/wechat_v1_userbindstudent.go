package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1UserBindStudentService(
	logger log.Logger,
	wechatV1UserBindStudentUseCase *biz.WechatV1UserBindStudentUseCase,
) *WechatV1UserBindStudentService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1UserBindStudent"), log.WithMessageKey("message"))
	return &WechatV1UserBindStudentService{
		log:                            l,
		wechatV1UserBindStudentUseCase: wechatV1UserBindStudentUseCase,
	}
}

type WechatV1UserBindStudentService struct {
	pb.UnimplementedUserBindStudentServer
	log                            *log.Helper
	wechatV1UserBindStudentUseCase *biz.WechatV1UserBindStudentUseCase
}

// StoreUserBindStudent 用户绑定学生-创建一条数据
func (w *WechatV1UserBindStudentService) StoreUserBindStudent(ctx context.Context, req *pb.StoreUserBindStudentReq) (*pb.StoreUserBindStudentReply, error) {
	return w.wechatV1UserBindStudentUseCase.StoreUserBindStudent(ctx, req)
}

// DeleteUserBindStudent 用户绑定学生-删除多条数据
func (w *WechatV1UserBindStudentService) DeleteUserBindStudent(ctx context.Context, req *pb.DeleteUserBindStudentReq) (*pb.DeleteUserBindStudentReply, error) {
	return w.wechatV1UserBindStudentUseCase.DeleteUserBindStudent(ctx, req)
}

// GetUserBindStudentList 用户绑定学生-列表数据查询
func (w *WechatV1UserBindStudentService) GetUserBindStudentList(ctx context.Context, req *pb.GetUserBindStudentListReq) (*pb.GetUserBindStudentListReply, error) {
	return w.wechatV1UserBindStudentUseCase.GetUserBindStudentList(ctx, req)
}

// GetUserBindStudentInfo 用户绑定学生-单条数据查询
func (w *WechatV1UserBindStudentService) GetUserBindStudentInfo(ctx context.Context, req *pb.GetUserBindStudentInfoReq) (*pb.GetUserBindStudentInfoReply, error) {
	return w.wechatV1UserBindStudentUseCase.GetUserBindStudentInfo(ctx, req)
}
