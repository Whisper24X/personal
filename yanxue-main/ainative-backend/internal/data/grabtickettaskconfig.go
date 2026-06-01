package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.GrabTicketTaskConfigRepo = (*GrabTicketTaskConfigRepo)(nil)

func NewGrabTicketTaskConfigRepo(
	logger log.Logger,
	data *Data,
	grabTicketTaskConfigRepo *yanxue_repo.GrabTicketTaskConfigRepo,
) biz.GrabTicketTaskConfigRepo {
	l := log.NewHelper(log.With(logger, "module", "data/grabTicketTaskConfig"), log.WithMessageKey("message"))
	return &GrabTicketTaskConfigRepo{
		log:                      l,
		data:                     data,
		GrabTicketTaskConfigRepo: grabTicketTaskConfigRepo,
	}
}

type GrabTicketTaskConfigRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.GrabTicketTaskConfigRepo
}
