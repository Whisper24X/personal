package biz

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewShadowV1ContractUseCase(
	logger log.Logger,
	eSignRepo EsignRepo,
	contractTemplateRepo ContractTemplateRepo,
	contractRecordRepo ContractRecordRepo,
	asyncTaskRepo AsyncTaskRepo,
	sysAdminRepo SysAdminRepo,
	ycOssHttpRpc *rpc.YcOssHttpRpc,
	sysDataLogRepo SysDataLogRepo,
	courseAppointmentRepo CourseAppointmentRepo,
	courseRepo CourseRepo,
) *ShadowV1ContractUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Contract"), log.WithMessageKey("message"))
	return &ShadowV1ContractUseCase{
		log:                   l,
		eSignRepo:             eSignRepo,
		contractTemplateRepo:  contractTemplateRepo,
		contractRecordRepo:    contractRecordRepo,
		asyncTaskRepo:         asyncTaskRepo,
		sysAdminRepo:          sysAdminRepo,
		ycOssHttpRpc:          ycOssHttpRpc,
		sysDataLogRepo:        sysDataLogRepo,
		courseAppointmentRepo: courseAppointmentRepo,
		courseRepo:            courseRepo,
	}
}

type ShadowV1ContractUseCase struct {
	log                   *log.Helper
	eSignRepo             EsignRepo
	contractTemplateRepo  ContractTemplateRepo
	contractRecordRepo    ContractRecordRepo
	asyncTaskRepo         AsyncTaskRepo
	sysAdminRepo          SysAdminRepo
	ycOssHttpRpc          *rpc.YcOssHttpRpc
	sysDataLogRepo        SysDataLogRepo
	courseAppointmentRepo CourseAppointmentRepo
	courseRepo            CourseRepo
}
