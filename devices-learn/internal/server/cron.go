package server

import (
	"context"
	"fmt"

	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/service"
	"gitlab.yc345.tv/backend/utils/v2/cron"
	"gitlab.yc345.tv/backend/utils/v2/errgroup"
	"gitlab.yc345.tv/backend/utils/v2/notify"
	FeiShu "gitlab.yc345.tv/backend/utils/v2/notify/feishu"
)

// Cron 定时任务
type Cron struct {
	Tasks []*cron.Cron
}

// Start 启动定时任务.
func (k *Cron) Start(ctx context.Context) error {
	group := errgroup.WithContext(ctx)
	for _, task := range k.Tasks {
		c := task
		group.Go(func(ctx context.Context) error {
			return c.Start(ctx)
		})
	}
	defer fmt.Println("cron tasks start")
	return group.Wait()
}

// Stop 停止定时任务
func (k *Cron) Stop(ctx context.Context) error {
	group := errgroup.WithContext(ctx)
	for _, task := range k.Tasks {
		c := task
		group.Go(func(ctx context.Context) error {
			return c.Stop(ctx)
		})
	}
	defer fmt.Println("cron tasks stop")
	return group.Wait()
}

// NewTask new a task.
func NewTask(cgf *conf.CronTasks_CronTask, processFunc cron.ProcessFunc) (*cron.Cron, error) {
	n, err := Notify(cgf.Notify)
	if err != nil {
		fmt.Println("newTask Notify err:", err)
		return nil, err
	}
	// 任务
	t := cron.New().SetTasks(&cron.Task{
		Name:    cgf.Name,
		CronStr: cgf.Cron,
		Process: processFunc,
	}).SetIfStillRunningStatus(cron.StillRunning(cgf.Mode))
	if cgf.Notify.GetType() != conf.CronTasks_NONE {
		t.SetNotify(n, cron.InfoNotify)
	}
	fmt.Printf("corn new task name:%s, cron:%s\n", cgf.Name, cgf.Cron)
	return t, nil
}

// Notify 通知方式
func Notify(c *conf.CronTasks_Notify) (notify.Notify, error) {
	var n notify.Notify
	var err error
	switch c.Type {
	case conf.CronTasks_FEISHU:
		n, err = FeiShu.NewNotify(c.FeiShu.Url, c.FeiShu.Title)
		if err != nil {
			fmt.Println("notify NewNotify err:", err)
			return nil, err
		}
	default:
	}
	return n, nil
}

// NewCronServer new a Cron server.
func NewCronServer(config *conf.Bootstrap, et *service.DevicesLearnV1AsyncService) (*Cron, error) {
	resp := &Cron{
		Tasks: make([]*cron.Cron, 0),
	}
	tasks := config.GetYc().GetCronTasks().GetTasks()
	if len(tasks) == 0 {
		return resp, nil
	}
	task1, err := NewTask(tasks["task1"], et.CronTaskTest1)
	if err != nil {
		return nil, err
	}
	task2, err := NewTask(tasks["task2"], et.CronTaskTest2)
	if err != nil {
		return nil, err
	}
	resp.Tasks = append(resp.Tasks, task1, task2)
	return resp, nil
}
