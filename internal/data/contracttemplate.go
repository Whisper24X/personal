package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.ContractTemplateRepo = (*ContractTemplateRepo)(nil)

func NewContractTemplateRepo(
	logger log.Logger,
	data *Data,
	contractTemplateRepo *yanxue_repo.ContractTemplateRepo,
) biz.ContractTemplateRepo {
	l := log.NewHelper(log.With(logger, "module", "data/contractTemplate"), log.WithMessageKey("message"))
	return &ContractTemplateRepo{
		log:                  l,
		data:                 data,
		ContractTemplateRepo: contractTemplateRepo,
	}
}

type ContractTemplateRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.ContractTemplateRepo
}
