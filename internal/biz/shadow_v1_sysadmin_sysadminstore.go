package biz

import (
	"context"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/strutil"
)

// SysAdminStore 管理用户-保存管理员
func (s *ShadowV1SysAdminUseCase) SysAdminStore(ctx context.Context, req *pb.SysAdminStoreReq) (*pb.SysAdminStoreReply, error) {
	resp := &pb.SysAdminStoreReply{}
	ph, err := cryptutil.YcPhoneEncrypt(req.GetPhone())
	if err != nil {
		return nil, errorx.DataEncryptErr.WithError(err).Err()
	}
	err = s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		var sysAdmin *yanxue_model.SysAdmin
		if req.GetId() == "" {
			// 判断用户名是否重复
			sysAdminRepeat, err := s.sysAdminRepo.FindOneCacheByPh(ctx, ph)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			if sysAdminRepeat != nil && sysAdminRepeat.ID != "" {
				return errorx.AccountPhoneDuplicate.Err()
			}
			sysAdmin = &yanxue_model.SysAdmin{
				ID:          "",
				Ph:          ph,
				Pw:          "",
				Salt:        "",
				Nickname:    req.GetNickname(),
				Avatar:      req.GetAvatar(),
				Status:      int16(constant.StatusEnable),
				IsChangePwd: false,
			}
			// 设置密码
			salt := strutil.Random(16)
			// 手机号后 6 位
			pwd := req.GetPhone()[len(req.GetPhone())-6:]
			pwd, err = cryptutil.Encrypt(pwd + salt)
			if err != nil {
				return errorx.DataProcessingError.WithError(err).Err()
			}
			sysAdmin.Salt = salt
			sysAdmin.Pw = pwd
			err = s.sysAdminRepo.CreateOneCacheByTx(ctx, tx, sysAdmin)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			resp.Id = sysAdmin.ID
		} else {
			// 编辑
			sysAdmin, err = s.sysAdminRepo.FindOneCacheByID(ctx, req.GetId())
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			if sysAdmin == nil || sysAdmin.ID == "" {
				return errorx.AccountNotExist.Err()
			}
			oldSysAdmin := s.sysAdminRepo.DeepCopy(sysAdmin)
			if ph != sysAdmin.Ph {
				// 判断用户名是否重复
				sysAdminRepeat, err := s.sysAdminRepo.FindOneCacheByPh(ctx, ph)
				if err != nil {
					return errorx.DataSQLErr.WithError(err).Err()
				}
				if sysAdminRepeat != nil && sysAdminRepeat.ID != req.GetId() {
					return errorx.AccountPhoneDuplicate.Err()
				}
			}
			sysAdmin.Ph = ph
			sysAdmin.Nickname = req.GetNickname()
			sysAdmin.Avatar = req.GetAvatar()
			sysAdmin.Status = int16(req.GetStatus())
			err = s.sysAdminRepo.UpdateOneCacheWithZeroByTx(ctx, tx, sysAdmin, oldSysAdmin)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			// 强制退出
			_ = s.sysAdminRepo.ExpiredToken(ctx, []string{sysAdmin.ID})
		}
		if len(req.GetRoleIds()) > 0 {
			roleIds := lo.Uniq(req.GetRoleIds())
			err = s.sysAdminRoleRepo.DeleteMultiByAdminIDTx(ctx, tx, sysAdmin.ID)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			addRoles := make([]*yanxue_model.SysAdminRole, 0)
			for _, roleId := range roleIds {
				addRoles = append(addRoles, &yanxue_model.SysAdminRole{
					AdminID: sysAdmin.ID,
					RoleID:  roleId,
				})
			}
			err = s.sysAdminRoleRepo.CreateBatchCacheByTx(ctx, tx, addRoles, 100)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		if len(req.GetDeptIds()) > 0 {
			deptIds := lo.Uniq(req.GetDeptIds())
			err = s.sysAdminDeptRepo.DeleteMultiByAdminIDTx(ctx, tx, sysAdmin.ID)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			addDepts := make([]*yanxue_model.SysAdminDept, 0)
			for _, deptId := range deptIds {
				addDepts = append(addDepts, &yanxue_model.SysAdminDept{
					AdminID: sysAdmin.ID,
					DeptID:  deptId,
				})
			}
			err = s.sysAdminDeptRepo.CreateBatchCacheByTx(ctx, tx, addDepts, 100)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		resp.Id = sysAdmin.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
