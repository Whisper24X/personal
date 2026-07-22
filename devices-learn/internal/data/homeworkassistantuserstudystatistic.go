package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.HomeworkAssistantUserStudyStatisticRepo = (*HomeworkAssistantUserStudyStatisticRepo)(nil)

func NewHomeworkAssistantUserStudyStatisticRepo(
	logger log.Logger,
	data *Data,
	homeworkAssistantUserStudyStatisticRepo *devices_learn_repo.HomeworkAssistantUserStudyStatisticRepo,
) biz.HomeworkAssistantUserStudyStatisticRepo {
	l := log.NewHelper(log.With(logger, "module", "data/homeworkAssistantUserStudyStatistic"))
	return &HomeworkAssistantUserStudyStatisticRepo{
		log:                                     l,
		data:                                    data,
		HomeworkAssistantUserStudyStatisticRepo: homeworkAssistantUserStudyStatisticRepo,
	}
}

type HomeworkAssistantUserStudyStatisticRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.HomeworkAssistantUserStudyStatisticRepo
}
