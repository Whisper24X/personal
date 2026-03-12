package biz

import (
	"context"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// SysRoleStore 角色-保存角色
func (s *ShadowV1SysRoleUseCase) SysRoleStore(ctx context.Context, req *pb.SysRoleStoreReq) (*pb.SysRoleStoreResp, error) {
	resp := &pb.SysRoleStoreResp{
		Id: "",
	}
	sysRole := &yanxue_model.SysRole{}
	var err error
	err = s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		if req.GetId() == "" {
			sysRole = &yanxue_model.SysRole{
				ID:             req.GetId(),
				Name:           req.GetName(),
				Remark:         req.GetRemark(),
				DataPermission: req.GetDataPermission(),
				Status:         int16(req.GetStatus()),
			}
			// 新增
			err := s.sysRoleRepo.CreateOneCache(ctx, sysRole)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		} else {
			// 更新
			sysRole, err = s.sysRoleRepo.FindOneCacheByID(ctx, req.GetId())
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			if sysRole == nil || sysRole.ID == "" {
				return errorx.DataRecordNotFound.Err()
			}
			oldSysRole := s.sysRoleRepo.DeepCopy(sysRole)
			sysRole.Name = req.GetName()
			sysRole.Remark = req.GetRemark()
			sysRole.DataPermission = req.GetDataPermission()
			sysRole.Status = int16(req.GetStatus())
			err = s.sysRoleRepo.UpdateOneCacheWithZero(ctx, sysRole, oldSysRole)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		err = s.sysRolePermissionRepo.DeleteMultiByRoleIDTx(ctx, tx, sysRole.ID)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		if len(req.GetPermissionIds()) > 0 {
			permissionIds := lo.Uniq(req.GetPermissionIds())
			addPermissions := make([]*yanxue_model.SysRolePermission, 0)
			for _, permissionId := range permissionIds {
				addPermissions = append(addPermissions, &yanxue_model.SysRolePermission{
					RoleID:       sysRole.ID,
					PermissionID: permissionId,
				})
			}
			err = s.sysRolePermissionRepo.CreateBatchCacheByTx(ctx, tx, addPermissions, 100)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			// 查询角色关联的管理员
			sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByRoleID(ctx, sysRole.ID)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			adminIds := lo.Map(sysAdminRoles, func(item *yanxue_model.SysAdminRole, _ int) string {
				return item.AdminID
			})
			err = s.sysAdminRepo.ExpiredToken(ctx, adminIds)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		resp.Id = sysRole.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
