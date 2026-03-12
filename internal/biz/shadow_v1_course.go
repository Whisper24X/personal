package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1CourseUseCase(
	logger log.Logger,
	commonRepo CommonRepo,
	courseRepo CourseRepo,
	courseStockRepo CourseStockRepo,
	sysAdminRepo SysAdminRepo,
	goodRepo GoodRepo,
) *ShadowV1CourseUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Course"), log.WithMessageKey("message"))
	return &ShadowV1CourseUseCase{
		log:             l,
		commonRepo:      commonRepo,
		courseRepo:      courseRepo,
		courseStockRepo: courseStockRepo,
		sysAdminRepo:    sysAdminRepo,
		goodRepo:        goodRepo,
	}
}

type ShadowV1CourseUseCase struct {
	log             *log.Helper
	commonRepo      CommonRepo
	sysAdminRepo    SysAdminRepo
	courseRepo      CourseRepo
	courseStockRepo CourseStockRepo
	goodRepo        GoodRepo
}
