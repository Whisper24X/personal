package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/course_learn/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewCourseLearnV1CourseLearnService(
	logger log.Logger,
	courseLearnV1CourseLearnUseCase *biz.CourseLearnV1CourseLearnUseCase,
) *CourseLearnV1CourseLearnService {
	l := log.NewHelper(log.With(logger, "module", "service/courseLearnV1CourseLearn"), log.WithMessageKey("message"))
	return &CourseLearnV1CourseLearnService{
		log:                             l,
		courseLearnV1CourseLearnUseCase: courseLearnV1CourseLearnUseCase,
	}
}

type CourseLearnV1CourseLearnService struct {
	pb.UnimplementedCourseLearnServer
	log                             *log.Helper
	courseLearnV1CourseLearnUseCase *biz.CourseLearnV1CourseLearnUseCase
}

// GetTopicFinishedByCvsIds cvs册下知识点完成情况
func (c *CourseLearnV1CourseLearnService) GetTopicFinishedByCvsIds(ctx context.Context, req *pb.GetTopicFinishedByCvsIdsRequest) (*pb.GetTopicFinishedByCvsIdsReply, error) {
	return c.courseLearnV1CourseLearnUseCase.GetTopicFinishedByCvsIds(ctx, req)
}

// GetTopicScoreByIds 知识点进度
func (c *CourseLearnV1CourseLearnService) GetTopicScoreByIds(ctx context.Context, req *pb.GetTopicScoreByIdsRequest) (*pb.GetTopicScoreByIdsReply, error) {
	return c.courseLearnV1CourseLearnUseCase.GetTopicScoreByIds(ctx, req)
}
