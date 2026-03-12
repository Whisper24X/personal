package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.ContractRecordRepo = (*ContractRecordRepo)(nil)

func NewContractRecordRepo(
	logger log.Logger,
	data *Data,
	contractRecordRepo *yanxue_repo.ContractRecordRepo,
) biz.ContractRecordRepo {
	l := log.NewHelper(log.With(logger, "module", "data/contractRecord"), log.WithMessageKey("message"))
	return &ContractRecordRepo{
		log:                l,
		data:               data,
		ContractRecordRepo: contractRecordRepo,
	}
}

type ContractRecordRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.ContractRecordRepo
}
