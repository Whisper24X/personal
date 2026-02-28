package server

import (
	"context"
	"fmt"

	"gitlab.yc345.tv/backend/utils/v2/cron"
	"gitlab.yc345.tv/backend/utils/v2/errgroup"
	"gitlab.yc345.tv/backend/utils/v2/notify"
	FeiShu "gitlab.yc345.tv/backend/utils/v2/notify/feishu"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/service"
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
func NewCronServer(
	config *conf.Bootstrap,
	yanxueV1AsyncService *service.YanxueV1AsyncService,
	shadowV1ContractService *service.ShadowV1ContractService,
) (*Cron, error) {
	fmt.Println("NewCronServer !!!!!!!!!!!!!!!!!")
	resp := &Cron{
		Tasks: make([]*cron.Cron, 0),
	}
	tasks := config.GetYc().GetCronTasks().GetTasks()
	if len(tasks) == 0 {
		return resp, nil
	}
	syncContractStatus, err := NewTask(tasks["syncContractStatus"], shadowV1ContractService.SyncContractStatus)
	if err != nil {
		return nil, err
	}
	finishCourseAppointment, err := NewTask(tasks["finishCourseAppointment"], yanxueV1AsyncService.CourseAppointmentFinish)
	if err != nil {
		return nil, err
	}
	feiShuReportAppointmentSituation, err := NewTask(tasks["feiShuReportAppointmentSituation"], yanxueV1AsyncService.FeiShuReportAppointmentSituation)
	if err != nil {
		return nil, err
	}
	syncOrderRefundStatus, err := NewTask(tasks["syncOrderRefundStatus"], yanxueV1AsyncService.SyncOrderRefundStatus)
	if err != nil {
		return nil, err
	}
	syncWeiDianOrder, err := NewTask(tasks["syncWeiDianOrder"], yanxueV1AsyncService.SyncWeiDianOrder)
	if err != nil {
		return nil, err
	}
	closeExpiredOrders, err := NewTask(tasks["closeExpiredOrders"], yanxueV1AsyncService.CloseExpiredOrders)
	if err != nil {
		return nil, err
	}
	syncWechatPayOrderStatus, err := NewTask(tasks["syncWechatPayOrderStatus"], yanxueV1AsyncService.SyncWechatPayOrderStatus)
	if err != nil {
		return nil, err
	}
	expireUserCoupons, err := NewTask(tasks["expireUserCoupons"], yanxueV1AsyncService.ExpireUserCoupons)
	if err != nil {
		return nil, err
	}
	syncWechatPayBill, err := NewTask(tasks["syncWechatPayBill"], yanxueV1AsyncService.SyncWechatPayBill)
	if err != nil {
		return nil, err
	}
	syncDouYinSettleInfo, err := NewTask(tasks["syncDouYinSettleInfo"], yanxueV1AsyncService.SyncDouYinSettleInfo)
	if err != nil {
		return nil, err
	}
	syncWechatPayBillPlatformFee, err := NewTask(tasks["syncWechatPayBillPlatformFee"], yanxueV1AsyncService.SyncWechatPayBillPlatformFee)
	if err != nil {
		return nil, err
	}
	fixOrderData, err := NewTask(tasks["fixOrderData"], yanxueV1AsyncService.FixOrderData)
	if err != nil {
		return nil, err
	}
	retryFailedOrderCallback, err := NewTask(tasks["retryFailedOrderCallback"], yanxueV1AsyncService.RetryFailedOrderCallback)
	if err != nil {
		return nil, err
	}
	sendAppointmentReminderSms, err := NewTask(tasks["sendAppointmentReminderSms"], yanxueV1AsyncService.SendAppointmentReminderSms)
	if err != nil {
		return nil, err
	}
	resp.Tasks = append(
		resp.Tasks,
		syncContractStatus,
		finishCourseAppointment,
		feiShuReportAppointmentSituation,
		syncOrderRefundStatus,
		syncWeiDianOrder,
		closeExpiredOrders,
		syncWechatPayOrderStatus,
		expireUserCoupons,
		syncWechatPayBill,
		syncDouYinSettleInfo,
		syncWechatPayBillPlatformFee,
		fixOrderData,
		retryFailedOrderCallback,
		sendAppointmentReminderSms,
	)
	return resp, nil
}
