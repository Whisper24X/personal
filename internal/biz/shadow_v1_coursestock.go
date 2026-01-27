package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1CourseStockUseCase(
	logger log.Logger,
	commonRepo CommonRepo,
	sysAdminRepo SysAdminRepo,
	courseRepo CourseRepo,
	courseStockRepo CourseStockRepo,
	courseAppointmentRepo CourseAppointmentRepo,
) *ShadowV1CourseStockUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1CourseStock"), log.WithMessageKey("message"))
	return &ShadowV1CourseStockUseCase{
		log:                   l,
		commonRepo:            commonRepo,
		sysAdminRepo:          sysAdminRepo,
		courseRepo:            courseRepo,
		courseStockRepo:       courseStockRepo,
		courseAppointmentRepo: courseAppointmentRepo,
	}
}

type ShadowV1CourseStockUseCase struct {
	log                   *log.Helper
	commonRepo            CommonRepo
	sysAdminRepo          SysAdminRepo
	courseRepo            CourseRepo
	courseStockRepo       CourseStockRepo
	courseAppointmentRepo CourseAppointmentRepo
}
