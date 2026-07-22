package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/rabbitmq/amqp091-go"
)

func NewDevicesLearnV1AsyncService(
	logger log.Logger,
) *DevicesLearnV1AsyncService {
	l := log.NewHelper(log.With(logger, "module", "service/devicesV1Device"), log.WithMessageKey("message"))
	return &DevicesLearnV1AsyncService{
		log: l,
	}
}

type DevicesLearnV1AsyncService struct {
	log *log.Helper
}

// CronTaskTest1 定时任务-测试1
func (d *DevicesLearnV1AsyncService) CronTaskTest1(ctx context.Context) error {
	// 如果有分布式使用任务,请自行添加原子锁避免重复处理
	return nil
}

// CronTaskTest2 定时任务-测试2
func (d *DevicesLearnV1AsyncService) CronTaskTest2(ctx context.Context) error {
	// 如果有分布式使用任务,请自行添加原子锁避免重复处理
	return nil
}

// MqRabbitConsumerTaskTest MQ消费任务-测试
func (d *DevicesLearnV1AsyncService) MqRabbitConsumerTaskTest(payload []byte, delivery *amqp091.Delivery, autoAck bool) {
	if len(payload) > 0 {
		// 写逻辑
		d.log.Info("测试消费" + string(payload))
	}
	if !autoAck {
		err := delivery.Ack(true)
		if err != nil {
			return
		}
	}
}

// MqRabbitConsumerDeviceHeartbeat MQ消费任务-心跳
func (d *DevicesLearnV1AsyncService) MqRabbitConsumerDeviceHeartbeat(payload []byte, delivery *amqp091.Delivery, autoAck bool) {
	if len(payload) > 0 {
		// 写逻辑
		d.log.Info("MQ消费任务-心跳-测试消费" + string(payload))
	}
	if !autoAck {
		err := delivery.Ack(true)
		if err != nil {
			return
		}
	}
}
