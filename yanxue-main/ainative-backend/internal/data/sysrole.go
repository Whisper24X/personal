package data

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SysRoleRepo = (*SysRoleRepo)(nil)

func NewSysRoleRepo(
	logger log.Logger,
	data *Data,
	sysRoleRepo *yanxue_repo.SysRoleRepo,
) biz.SysRoleRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysRole"), log.WithMessageKey("message"))
	return &SysRoleRepo{
		log:         l,
		data:        data,
		SysRoleRepo: sysRoleRepo,
	}
}

type SysRoleRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysRoleRepo
}

// 数据权限的优先级 ： all > deptAndBelow > dept > self 获取优先级最大的权限
func (s *SysRoleRepo) GetDataPermissionPriority(ctx context.Context, data []*yanxue_model.SysRole) (constant.SysRoleDataPermissionType, error) {
	for _, role := range data {
		if role.DataPermission == constant.SysRoleDataPermissionTypeAll.String() {
			return constant.SysRoleDataPermissionTypeAll, nil
		}
		if role.DataPermission == constant.SysRoleDataPermissionTypeDeptAndBelow.String() {
			return constant.SysRoleDataPermissionTypeDeptAndBelow, nil
		}
		if role.DataPermission == constant.SysRoleDataPermissionTypeDept.String() {
			return constant.SysRoleDataPermissionTypeDept, nil
		}
		if role.DataPermission == constant.SysRoleDataPermissionTypeSelf.String() {
			return constant.SysRoleDataPermissionTypeSelf, nil
		}
	}
	return constant.SysRoleDataPermissionTypeSelf, nil
}
