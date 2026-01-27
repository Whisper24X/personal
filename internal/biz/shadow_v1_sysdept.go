package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1SysDeptUseCase(
	logger log.Logger,
	commonRepo CommonRepo,
	sysDeptRepo SysDeptRepo,
	sysAdminDeptRepo SysAdminDeptRepo,
) *ShadowV1SysDeptUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysDept"), log.WithMessageKey("message"))
	return &ShadowV1SysDeptUseCase{
		log:              l,
		commonRepo:       commonRepo,
		sysDeptRepo:      sysDeptRepo,
		sysAdminDeptRepo: sysAdminDeptRepo,
	}
}

type ShadowV1SysDeptUseCase struct {
	log              *log.Helper
	commonRepo       CommonRepo
	sysDeptRepo      SysDeptRepo
	sysAdminDeptRepo SysAdminDeptRepo
}
