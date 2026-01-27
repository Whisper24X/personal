package biz

import (
	"context"

	"github.com/dlclark/regexp2"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// SysAdminChangePwd 管理用户-修改密码
func (s *ShadowV1SysAdminUseCase) SysAdminChangePwd(ctx context.Context, req *pb.SysAdminChangePwdReq) (*pb.SysAdminChangePwdReply, error) {
	resp := &pb.SysAdminChangePwdReply{}
	// 正则校验新密码: 大小写字母加数字,长度不能少于6位
	re := regexp2.MustCompile(`^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z\d]{6,}$`, regexp2.None)
	isMatch, _ := re.MatchString(req.Password)
	if !isMatch {
		return nil, errorx.AccountPasswordFormatErr.Err()
	}
	adminId := meta.GetAdminID(ctx)
	sysAdmin, err := s.sysAdminRepo.FindOneCacheByID(ctx, adminId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysAdmin == nil || sysAdmin.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	// 校验旧密码是否一致
	if cryptutil.Compare(sysAdmin.Pw, req.OldPassword+sysAdmin.Salt) != nil {
		return nil, errorx.AccountOldPasswordErr.Err()
	}
	// 不能与旧密码相同
	if cryptutil.Compare(sysAdmin.Pw, req.Password+sysAdmin.Salt) == nil {
		return nil, errorx.AccountSamePassword.Err()
	}
	oldSysAdmin := s.sysAdminRepo.DeepCopy(sysAdmin)
	pw, err := cryptutil.Encrypt(req.Password + sysAdmin.Salt)
	if err != nil {
		return nil, errorx.DataProcessingError.WithError(err).Err()
	}
	sysAdmin.Pw = pw
	sysAdmin.IsChangePwd = true
	err = s.sysAdminRepo.UpdateOneCache(ctx, sysAdmin, oldSysAdmin)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
