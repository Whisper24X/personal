package biz

import "github.com/go-kratos/kratos/v2/log"

func NewCourseLearnV1CourseLearnUseCase(
	logger log.Logger,
) *CourseLearnV1CourseLearnUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/courseLearnV1CourseLearn"), log.WithMessageKey("message"))
	return &CourseLearnV1CourseLearnUseCase{
		log: l,
	}
}

type CourseLearnV1CourseLearnUseCase struct {
	log *log.Helper
}
