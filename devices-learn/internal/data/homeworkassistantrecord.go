package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.HomeworkAssistantRecordRepo = (*HomeworkAssistantRecordRepo)(nil)

func NewHomeworkAssistantRecordRepo(
	logger log.Logger,
	data *Data,
	homeworkAssistantRecordRepo *devices_learn_repo.HomeworkAssistantRecordRepo,
) biz.HomeworkAssistantRecordRepo {
	l := log.NewHelper(log.With(logger, "module", "data/homeworkAssistantRecord"))
	return &HomeworkAssistantRecordRepo{
		log:                         l,
		data:                        data,
		HomeworkAssistantRecordRepo: homeworkAssistantRecordRepo,
	}
}

type HomeworkAssistantRecordRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.HomeworkAssistantRecordRepo
}
