package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.HomeworkAssistantScoreRepo = (*HomeworkAssistantScoreRepo)(nil)

func NewHomeworkAssistantScoreRepo(
	logger log.Logger,
	data *Data,
	homeworkAssistantScoreRepo *devices_learn_repo.HomeworkAssistantScoreRepo,
) biz.HomeworkAssistantScoreRepo {
	l := log.NewHelper(log.With(logger, "module", "data/homeworkAssistantScore"))
	return &HomeworkAssistantScoreRepo{
		log:                        l,
		data:                       data,
		HomeworkAssistantScoreRepo: homeworkAssistantScoreRepo,
	}
}

type HomeworkAssistantScoreRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.HomeworkAssistantScoreRepo
}
