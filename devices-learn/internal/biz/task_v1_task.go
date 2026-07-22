package biz

import "github.com/go-kratos/kratos/v2/log"

func NewTaskV1TaskUseCase(
	logger log.Logger,
) *TaskV1TaskUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/taskV1Task"), log.WithMessageKey("message"))
	return &TaskV1TaskUseCase{
		log: l,
	}
}

type TaskV1TaskUseCase struct {
	log *log.Helper
}
