package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/strutil"
)

// SysAdminResetPwd 管理用户-密码重置
func (s *ShadowV1SysAdminUseCase) SysAdminResetPwd(ctx context.Context, req *pb.SysAdminResetPwdReq) (*pb.SysAdminResetPwdReply, error) {
	resp := &pb.SysAdminResetPwdReply{}
	sysAdmin, err := s.sysAdminRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysAdmin == nil || sysAdmin.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	// 解密手机号
	phone, err := cryptutil.YcPhoneDecrypt(sysAdmin.Ph)
	if err != nil {
		return nil, errorx.DataEncryptErr.WithError(err).Err()
	}
	// 密码重置为手机号后 6 位
	salt := strutil.Random(16)
	pwd := phone[len(phone)-6:]
	pwd, err = cryptutil.Encrypt(pwd + salt)
	if err != nil {
		return nil, errorx.DataEncryptErr.WithError(err).Err()
	}
	oldSysAdmin := s.sysAdminRepo.DeepCopy(sysAdmin)
	sysAdmin.Pw = pwd
	sysAdmin.Salt = salt
	sysAdmin.IsChangePwd = false
	err = s.sysAdminRepo.UpdateOneCacheWithZero(ctx, sysAdmin, oldSysAdmin)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 强制退出
	_ = s.sysAdminRepo.ExpiredToken(ctx, []string{sysAdmin.ID})
	return resp, nil
}
