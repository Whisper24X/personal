package biz

import (
	"context"
	"math/rand"
	"strconv"

	"github.com/google/uuid"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// AuthSendPhoneSmsCode User-手机号-发送手机验证码
func (w *WechatV1UserUseCase) AuthSendPhoneSmsCode(ctx context.Context, req *pb.AuthSendPhoneSmsCodeReq) (*pb.AuthSendPhoneSmsCodeReply, error) {
	resp := &pb.AuthSendPhoneSmsCodeReply{}
	// 验证用户微信ID
	userWx, err := w.userWxRepo.FindOneCacheByID(ctx, req.GetUserWxId())
	if err != nil {
		return nil, errorx.DataSQLErr.Err()
	}
	if userWx == nil || userWx.ID == "" {
		return nil, errorx.WxUserNotExist.Err()
	}
	ph, err := cryptutil.YcPhoneEncrypt(req.GetPhone())
	if err != nil {
		return nil, errorx.DataFormattingError.Err()
	}
	// 验证手机号是否已绑定其他微信用户
	user, err := w.userRepo.FindOneCacheByPh(ctx, ph)
	if err != nil {
		return nil, errorx.DataSQLErr.Err()
	}
	if user != nil && user.ID != "" && user.UserWxID != "" {
		return nil, errorx.WxUserPhoneAlreadyBound.Err()
	}
	// 检查短信发送频率限制
	err = w.userRepo.CheckSmsCodeFrequency(ctx, req.GetPhone())
	if err != nil {
		return nil, err
	}
	// 生成4位验证码
	code := strconv.Itoa(rand.Intn(9000) + 1000)
	smsId := uuid.New().String()
	// 发送短信验证码
	err = w.userRepo.SendSmsCode(ctx, req.GetPhone(), code)
	if err != nil {
		return nil, errorx.SmsSendErr.WithError(err).Err()
	}
	// 存储验证码到Redis
	if err := w.userRepo.SetSmsCode(ctx, smsId, code, req.GetPhone(), req.GetUserWxId()); err != nil {
		return nil, errorx.SmsSendErr.WithError(err).Err()
	}
	// 更新短信发送频率计数
	_ = w.userRepo.SetSmsCodeFrequency(ctx, req.GetPhone())
	// 返回手机号作为 SmsCodeId
	resp.SmsCodeId = smsId
	return resp, nil
}
