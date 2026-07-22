package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/task/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewTaskV1TaskService(
	logger log.Logger,
	taskV1TaskUseCase *biz.TaskV1TaskUseCase,
) *TaskV1TaskService {
	l := log.NewHelper(log.With(logger, "module", "service/taskV1Task"), log.WithMessageKey("message"))
	return &TaskV1TaskService{
		log:               l,
		taskV1TaskUseCase: taskV1TaskUseCase,
	}
}

type TaskV1TaskService struct {
	pb.UnimplementedTaskServer
	log               *log.Helper
	taskV1TaskUseCase *biz.TaskV1TaskUseCase
}

// TaskListApi 任务列表
func (t *TaskV1TaskService) TaskListApi(ctx context.Context, req *pb.TaskListApiRequest) (*pb.TaskListApiReply, error) {
	return t.taskV1TaskUseCase.TaskListApi(ctx, req)
}

// TaskFinish 完成任务
func (t *TaskV1TaskService) TaskFinish(ctx context.Context, req *pb.TaskFinishRequest) (*pb.ReplyBool, error) {
	return t.taskV1TaskUseCase.TaskFinish(ctx, req)
}

// TaskReward 领取任务奖励
func (t *TaskV1TaskService) TaskReward(ctx context.Context, req *pb.TaskRewardRequest) (*pb.TaskRewardReply, error) {
	return t.taskV1TaskUseCase.TaskReward(ctx, req)
}
