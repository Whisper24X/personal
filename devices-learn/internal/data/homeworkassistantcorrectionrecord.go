package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.HomeworkAssistantCorrectionRecordRepo = (*HomeworkAssistantCorrectionRecordRepo)(nil)

func NewHomeworkAssistantCorrectionRecordRepo(
	logger log.Logger,
	data *Data,
	homeworkAssistantCorrectionRecordRepo *devices_learn_repo.HomeworkAssistantCorrectionRecordRepo,
) biz.HomeworkAssistantCorrectionRecordRepo {
	l := log.NewHelper(log.With(logger, "module", "data/homeworkAssistantCorrectionRecord"))
	return &HomeworkAssistantCorrectionRecordRepo{
		log:                                   l,
		data:                                  data,
		HomeworkAssistantCorrectionRecordRepo: homeworkAssistantCorrectionRecordRepo,
	}
}

type HomeworkAssistantCorrectionRecordRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.HomeworkAssistantCorrectionRecordRepo
}
