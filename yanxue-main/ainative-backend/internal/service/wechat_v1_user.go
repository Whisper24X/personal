package service

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1UserService(
	logger log.Logger,
	wechatV1UserUseCase *biz.WechatV1UserUseCase,
) *WechatV1UserService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1User"), log.WithMessageKey("message"))
	return &WechatV1UserService{
		log:                 l,
		wechatV1UserUseCase: wechatV1UserUseCase,
	}
}

type WechatV1UserService struct {
	pb.UnimplementedUserServer
	log                 *log.Helper
	wechatV1UserUseCase *biz.WechatV1UserUseCase
}

// OfficialAccountCallback 公众号-回调
func (w *WechatV1UserService) OfficialAccountCallback(wr http.ResponseWriter, r *http.Request) {
	w.wechatV1UserUseCase.OfficialAccountCallback(wr, r)
}

// AuthLogin User-登录
func (w *WechatV1UserService) AuthLogin(ctx context.Context, req *pb.AuthLoginReq) (*pb.AuthLoginReply, error) {
	return w.wechatV1UserUseCase.AuthLogin(ctx, req)
}

// AuthSendPhoneSmsCode User-手机号-发送手机验证码
func (w *WechatV1UserService) AuthSendPhoneSmsCode(ctx context.Context, req *pb.AuthSendPhoneSmsCodeReq) (*pb.AuthSendPhoneSmsCodeReply, error) {
	return w.wechatV1UserUseCase.AuthSendPhoneSmsCode(ctx, req)
}

// AuthPhoneLogin User-手机号-登录
func (w *WechatV1UserService) AuthPhoneLogin(ctx context.Context, req *pb.AuthPhoneLoginReq) (*pb.AuthPhoneLoginReply, error) {
	return w.wechatV1UserUseCase.AuthPhoneLogin(ctx, req)
}

// AuthCheckToken User-检查token
func (w *WechatV1UserService) AuthCheckToken(ctx context.Context, req *pb.AuthCheckTokenReq) (*pb.AuthCheckTokenReply, error) {
	return w.wechatV1UserUseCase.AuthCheckToken(ctx, req)
}

// UserGetInfo User-获取用户信息
func (w *WechatV1UserService) UserGetInfo(ctx context.Context, req *pb.UserGetInfoReq) (*pb.UserGetInfoReply, error) {
	return w.wechatV1UserUseCase.UserGetInfo(ctx, req)
}

// AuthLoginXcx User-登录(小程序)
func (w *WechatV1UserService) AuthLoginXcx(ctx context.Context, req *pb.AuthLoginXcxReq) (*pb.AuthLoginXcxReply, error) {
	return w.wechatV1UserUseCase.AuthLoginXcx(ctx, req)
}

// UpdateUserInfo User-更新用户信息
func (w *WechatV1UserService) UpdateUserInfo(ctx context.Context, req *pb.UpdateUserInfoReq) (*pb.UpdateUserInfoReply, error) {
	return w.wechatV1UserUseCase.UpdateUserInfo(ctx, req)
}

// StoreParentInfo User-更新监护人信息
func (w *WechatV1UserService) StoreParentInfo(ctx context.Context, req *pb.StoreParentInfoReq) (*pb.StoreParentInfoReply, error) {
	return w.wechatV1UserUseCase.StoreParentInfo(ctx, req)
}

// QueryParentInfo User-查询监护人信息
func (w *WechatV1UserService) QueryParentInfo(ctx context.Context, req *pb.QueryParentInfoReq) (*pb.QueryParentInfoReply, error) {
	return w.wechatV1UserUseCase.QueryParentInfo(ctx, req)
}
