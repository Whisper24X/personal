package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.HomeworkAssistantRectificationRecordRepo = (*HomeworkAssistantRectificationRecordRepo)(nil)

func NewHomeworkAssistantRectificationRecordRepo(
	logger log.Logger,
	data *Data,
	homeworkAssistantRectificationRecordRepo *devices_learn_repo.HomeworkAssistantRectificationRecordRepo,
) biz.HomeworkAssistantRectificationRecordRepo {
	l := log.NewHelper(log.With(logger, "module", "data/homeworkAssistantRectificationRecord"))
	return &HomeworkAssistantRectificationRecordRepo{
		log:                                      l,
		data:                                     data,
		HomeworkAssistantRectificationRecordRepo: homeworkAssistantRectificationRecordRepo,
	}
}

type HomeworkAssistantRectificationRecordRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.HomeworkAssistantRectificationRecordRepo
}
