package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// SysAuthLogin Auth-登录
func (s *ShadowV1SysAuthUseCase) SysAuthLogin(ctx context.Context, req *pb.SysAuthLoginReq) (*pb.SysAuthLoginReply, error) {
	resp := &pb.SysAuthLoginReply{}
	ph, err := cryptutil.YcPhoneEncrypt(req.GetUsername())
	if err != nil {
		return nil, errorx.DataEncryptErr.WithError(err).Err()
	}
	// 用户校验
	sysAdmin, err := s.sysAdminRepo.FindOneCacheByPh(ctx, ph)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysAdmin == nil {
		return nil, errorx.AccountNotExist.Err()
	}
	if cryptutil.Compare(sysAdmin.Pw, req.Password+sysAdmin.Salt) != nil {
		return nil, errorx.AccountWrongPassword.Err()
	}
	if sysAdmin.Status != int16(constant.StatusEnable) {
		return nil, errorx.AccountAbnormalStatus.Err()
	}
	// 颁发token
	kv := make(map[string]interface{})
	kv["uid"] = sysAdmin.ID
	kv["adminId"] = sysAdmin.ID
	token, err := s.sysAdminRepo.GenerateJwTToken(ctx, kv)
	if err != nil {
		return nil, errorx.TokenGenerationFailed.WithError(err).Err()
	}
	resp.Token = token.Token
	resp.RefreshAt = token.RefreshAt
	resp.ExpiredAt = token.ExpiredAt
	return resp, nil
}
