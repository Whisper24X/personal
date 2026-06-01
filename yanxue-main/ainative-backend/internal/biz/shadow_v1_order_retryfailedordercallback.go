package biz

import (
	"context"
	"fmt"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// RetryFailedOrderCallback 重试失败的订单回调任务
func (s *ShadowV1OrderUseCase) RetryFailedOrderCallback(ctx context.Context, req *pb.RetryFailedOrderCallbackReq) (*pb.RetryFailedOrderCallbackReply, error) {
	resp := &pb.RetryFailedOrderCallbackReply{}

	// 使用分布式锁，防止并发执行
	err := s.commonRepo.LockOnce(ctx, cache.RetryFailedOrderCallbackLock.Key(), cache.RetryFailedOrderCallbackLock.TTL(), func() error {
		// 异步执行，避免阻塞接口响应
		go func() {
			s.retryFailedOrderCallbackAsync()
		}()
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// retryFailedOrderCallbackAsync 异步重试失败的订单回调任务
func (s *ShadowV1OrderUseCase) retryFailedOrderCallbackAsync() {
	ctx := context.Background()

	s.log.Infof("RetryFailedOrderCallback: 开始重试失败的订单回调任务")

	// 查询待处理且重试次数小于3的任务
	tasks, _, err := s.asyncTaskRepo.FindMultiByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "taskType",
				Exp:   condition.EQ,
				Value: constant.DouYinOrderCallbackTaskType,
				Logic: condition.AND,
			},
			{
				Field: "status",
				Exp:   condition.IN,
				Value: []interface{}{constant.AsyncTaskStatusPending, constant.AsyncTaskStatusFailed},
				Logic: condition.AND,
			},
			{
				Field: "retryTimes",
				Exp:   condition.LT,
				Value: 3,
				Logic: condition.AND,
			},
		},
	})

	if err != nil {
		s.log.Errorf("RetryFailedOrderCallback: 查询失败任务失败: %v", err)
		return
	}

	s.log.Infof("RetryFailedOrderCallback: 查询到%d个待重试的任务", len(tasks))

	if len(tasks) == 0 {
		s.log.Infof("RetryFailedOrderCallback: 没有需要重试的任务")
		return
	}

	var successCount int
	var failCount int
	var maxRetryReachedCount int

	// 处理每个任务
	for _, task := range tasks {
		s.log.Infof("RetryFailedOrderCallback: 开始重试任务, taskId=%s, retryTimes=%d, errorInfo=%s",
			task.ID, task.RetryTimes, task.ErrorInfo)

		// 使用闭包处理单个任务，确保状态正确更新
		func(currentTask *yanxue_model.AsyncTask) {
			// 内层 defer：处理 panic 异常
			defer func() {
				if r := recover(); r != nil {
					s.log.Errorf("RetryFailedOrderCallback: 处理任务时发生panic, taskId=%s, panic=%v", currentTask.ID, r)
					// 发生panic时，将任务状态恢复为pending，以便下次重试
					currentTask.RetryTimes++
					currentTask.Status = constant.AsyncTaskStatusPending
					currentTask.ErrorInfo = fmt.Sprintf("重试%d次时发生异常: %v", currentTask.RetryTimes, r)

					// 尝试更新任务状态
					recoverCtx := context.Background()
					if updateErr := s.asyncTaskRepo.UpdateOne(recoverCtx, currentTask); updateErr != nil {
						s.log.Errorf("RetryFailedOrderCallback: panic后更新任务状态失败, taskId=%s, err=%v", currentTask.ID, updateErr)
					}
					failCount++
				}
			}()

			// 创建带有重试标识的 context
			retryCtx := context.WithValue(ctx, "isRetryTask", true)

			// 从 TaskContent 中反序列化完整的 req
			var callbackReq pb.DouYinOrderInfoCallbackReq
			err = jsonutil.Unmarshal([]byte(currentTask.TaskContent), &callbackReq)
			if err != nil {
				// 如果反序列化失败，可能是旧数据格式（只有 content），使用兜底逻辑
				s.log.Warnf("RetryFailedOrderCallback: 反序列化完整req失败，使用兜底逻辑, taskId=%s, err=%v", currentTask.ID, err)
				callbackReq = pb.DouYinOrderInfoCallbackReq{
					Content: currentTask.TaskContent,
				}
			}

			// 调用 DouYinOrderInfoCallback 重新处理
			_, err = s.DouYinOrderInfoCallback(retryCtx, &callbackReq)

			if err != nil {
				// 重试失败，增加重试次数
				currentTask.RetryTimes++

				s.log.Errorf("RetryFailedOrderCallback: 重试任务失败, taskId=%s, retryTimes=%d, err=%v",
					currentTask.ID, currentTask.RetryTimes, err)

				currentTask.ErrorInfo = fmt.Sprintf("重试%d次失败: %v", currentTask.RetryTimes, err)

				// 检查是否达到最大重试次数
				if currentTask.RetryTimes >= 3 {
					currentTask.Status = constant.AsyncTaskStatusFailed
					maxRetryReachedCount++
					s.log.Errorf("RetryFailedOrderCallback: 任务达到最大重试次数(3次)，标记为失败, taskId=%s", currentTask.ID)

					// 发送飞书通知
					go func(taskID, taskContent, errorInfo string) {
						s.sendFailedTaskNotification(context.Background(), taskID, taskContent, errorInfo)
					}(currentTask.ID, currentTask.TaskContent, currentTask.ErrorInfo)
				} else {
					currentTask.Status = constant.AsyncTaskStatusPending
				}

				failCount++
			} else {
				// 重试成功，不增加重试次数
				currentTask.Status = constant.AsyncTaskStatusSuccess
				currentTask.ErrorInfo = fmt.Sprintf("重试%d次后成功", currentTask.RetryTimes)
				successCount++
				s.log.Infof("RetryFailedOrderCallback: 重试任务成功, taskId=%s, retryTimes=%d",
					currentTask.ID, currentTask.RetryTimes)
			}

			// 更新任务
			err = s.asyncTaskRepo.UpdateOne(ctx, currentTask)
			if err != nil {
				s.log.Errorf("RetryFailedOrderCallback: 更新任务状态失败, taskId=%s, err=%v", currentTask.ID, err)

				// 如果更新失败，尝试将任务状态恢复为pending，确保下次能继续处理
				// 使用独立的context避免受原context影响
				recoverCtx := context.Background()

				// 如果当前不是成功状态，则恢复为pending；如果是成功状态，保持成功
				if currentTask.Status != constant.AsyncTaskStatusSuccess {
					currentTask.Status = constant.AsyncTaskStatusPending
					currentTask.ErrorInfo = fmt.Sprintf("重试%d次后更新状态失败，等待下次重试: %v", currentTask.RetryTimes, err)
				}

				// 再次尝试更新
				retryErr := s.asyncTaskRepo.UpdateOne(recoverCtx, currentTask)
				if retryErr != nil {
					s.log.Errorf("RetryFailedOrderCallback: 恢复任务状态也失败, taskId=%s, err=%v", currentTask.ID, retryErr)
				} else {
					s.log.Infof("RetryFailedOrderCallback: 成功恢复任务状态, taskId=%s, status=%s", currentTask.ID, currentTask.Status)
				}
			}
		}(task)
	}

	s.log.Infof("RetryFailedOrderCallback: 重试完成，总数=%d，成功=%d，失败=%d，达到最大重试次数=%d",
		len(tasks), successCount, failCount, maxRetryReachedCount)
}

// sendFailedTaskNotification 发送失败任务的飞书通知
func (s *ShadowV1OrderUseCase) sendFailedTaskNotification(ctx context.Context, taskID, taskContent, errorInfo string) {
	err := s.orderRepo.DouYinOrderCreateFailedFeiShuNotify(ctx, taskID, errorInfo, taskContent)
	if err != nil {
		s.log.Errorf("RetryFailedOrderCallback: 发送飞书通知失败, taskId=%s, err=%v", taskID, err)
	} else {
		s.log.Infof("RetryFailedOrderCallback: 成功发送飞书通知, taskId=%s", taskID)
	}
}
