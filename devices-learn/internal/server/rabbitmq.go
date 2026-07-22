package server

import (
	"context"

	"github.com/rabbitmq/amqp091-go"
	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/service"
	"gitlab.yc345.tv/backend/utils/v2/rabbitmq"
)

// RabbitConsumerServer rabbitmq 消费者服务
type RabbitConsumerServer struct {
	rabbitmq  *rabbitmq.Rabbitmq // mq
	consumers []*RabbitConsumer  // mq消费者集合
}

// RabbitConsumer rabbitmq 消费者
type RabbitConsumer struct {
	Consumer *rabbitmq.Consumer
	Process  func(payload []byte, delivery *amqp091.Delivery, autoAck bool)
}

// NewRabbitConsumerServer 实例化一个Rabbitmq消费者
func NewRabbitConsumerServer(cfg *conf.Bootstrap, rr *rabbitmq.Rabbitmq, aSyncService *service.DevicesLearnV1AsyncService) (*RabbitConsumerServer, error) {
	config := cfg.Yc.Rabbitmq[cfg.Name]
	server := &RabbitConsumerServer{
		rabbitmq:  rr,
		consumers: make([]*RabbitConsumer, 0),
	}
	err := server.RegisterRabbitmqConsumer(rr, config.Business["deviceHeartbeat"], aSyncService.MqRabbitConsumerDeviceHeartbeat)
	if err != nil {
		return nil, err
	}
	return server, nil
}

// RegisterRabbitmqConsumer 注册消费者程序
func (c *RabbitConsumerServer) RegisterRabbitmqConsumer(rc *rabbitmq.Rabbitmq, config *conf.RabbitMq_Business, process func(payload []byte, delivery *amqp091.Delivery, autoAck bool)) error {
	if config == nil || !config.Enable {
		return nil
	}
	consumer, err := rc.UseOrCreateConsumer(&rabbitmq.ConsumerConfig{
		ExchangeName:    config.ExchangeName,
		QueueName:       config.QueueName,
		BindingKey:      config.BindingKey,
		AutoCreateQueue: true,
		QueueConfig: &rabbitmq.QueueConfig{
			Durable:    true,
			AutoDelete: false,
			Exclusive:  false,
			NoWait:     false,
			Args:       nil,
		},
	}, false)
	if err != nil {
		return err
	}
	c.consumers = append(c.consumers, &RabbitConsumer{
		Consumer: consumer,
		Process:  process,
	})
	return nil
}

// Start 启动
func (c *RabbitConsumerServer) Start(ctx context.Context) error {
	if len(c.consumers) == 0 {
		return nil
	}
	for _, consumer := range c.consumers {
		consumer.Consumer.Consume(consumer.Process)
	}
	return nil
}

// Stop 停止
func (c *RabbitConsumerServer) Stop(ctx context.Context) error {
	return nil
}
