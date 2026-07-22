package biz

import "github.com/go-kratos/kratos/v2/log"

func NewHomeworkAssistantV1HomeworkAssistantUseCase(
	logger log.Logger,
) *HomeworkAssistantV1HomeworkAssistantUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/homeworkAssistantV1HomeworkAssistant"), log.WithMessageKey("message"))
	return &HomeworkAssistantV1HomeworkAssistantUseCase{
		log: l,
	}
}

type HomeworkAssistantV1HomeworkAssistantUseCase struct {
	log *log.Helper
}
