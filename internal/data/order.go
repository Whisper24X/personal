package data

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-redis/redis/v8"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/webhook"
)

var _ biz.OrderRepo = (*OrderRepo)(nil)

func NewOrderRepo(
	logger log.Logger,
	data *Data,
	orderRepo *yanxue_repo.OrderRepo,
	cfg *conf.Bootstrap,
) biz.OrderRepo {
	l := log.NewHelper(log.With(logger, "module", "data/order"), log.WithMessageKey("message"))
	return &OrderRepo{
		log:       l,
		data:      data,
		OrderRepo: orderRepo,
		cfg:       cfg,
	}
}

type OrderRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.OrderRepo
	cfg *conf.Bootstrap
}

func (r *OrderRepo) OrderIdToOrderNumber(ctx context.Context, orderIds []string) (map[string]string, error) {
	orderIdToOrderNumberMap := make(map[string]string)
	orderIdList, err := r.FindMultiByIDS(ctx, orderIds)
	if err != nil {
		return orderIdToOrderNumberMap, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, order := range orderIdList {
		orderIdToOrderNumberMap[order.ID] = order.OrderNumber
	}
	return orderIdToOrderNumberMap, nil
}

func (r *OrderRepo) GetOrderSummaryInfoByGoodIds(ctx context.Context, goodIds []string) (map[string]int32, error) {
	summaryInfoMap := make(map[string]int32)
	if len(goodIds) == 0 {
		return summaryInfoMap, nil
	}

	type Result struct {
		GoodId string `gorm:"column:channelGoodId"`
		Count  int32  `gorm:"column:count"`
	}

	var results []Result
	err := r.data.db.
		Table("order").
		Select("\"channelGoodId\", COUNT(*) as count").
		Where("\"channelGoodId\" IN ?", goodIds).
		Group("channelGoodId").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	for _, res := range results {
		summaryInfoMap[res.GoodId] = res.Count
	}

	// 没有查到的goodId，补0
	for _, id := range goodIds {
		if _, ok := summaryInfoMap[id]; !ok {
			summaryInfoMap[id] = 0
		}
	}

	return summaryInfoMap, nil
}

func (r *OrderRepo) CacheWeiDianAccessTokenGet(ctx context.Context) (string, error) {
	accessToken, err := r.data.goRedisClient.Get(ctx, cache.WeiDianAccessToken.Key()).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return accessToken, errorx.DataRedisErr.WithError(err).Err()
	}
	if accessToken == "" {
		return accessToken, nil
	}
	return accessToken, nil
}

func (r *OrderRepo) CacheWeiDianAccessTokenSet(ctx context.Context, accessToken string) error {
	return r.data.goRedisClient.Set(ctx, cache.WeiDianAccessToken.Key(), accessToken, cache.WeiDianAccessToken.TTL()).Err()
}

// OrderRefundFeiShuNotify 订单退款飞书通知
func (r *OrderRepo) OrderRefundFeiShuNotify(ctx context.Context, channelOrderNumber, channel, goodName string, unFinishedAppointmentCount int32) error {
	var template = `**用户新增退款，请及时取消相关预约**
**渠道订单编号:** %s
**购买渠道：**%s
**商品名称：**%s
**未完成预约数：**%d
`
	var content string
	content = fmt.Sprintf(template, channelOrderNumber, channel, goodName, unFinishedAppointmentCount)
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["createCourseAppointment"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: content,
					Tag:     "lark_md",
				},
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "取消预约提醒",
				Tag:     "plain_text",
			},
			Template: "blue",
		},
	}
	err := webhook.NewFeiShu(feiShuCfg.GetUrl(), feiShuCfg.GetSign()).SendCard(card)
	if err != nil {
		return err
	}
	return nil
}

// OrderRefundFailedFeiShuNotify 订单退款失败飞书通知
func (r *OrderRepo) OrderRefundFailedFeiShuNotify(ctx context.Context, channelOrderNumber, channel string) error {
	var template = `**用户退款失败，请及时处理**
**渠道订单编号:** %s
**购买渠道：**%s
`
	var content string
	content = fmt.Sprintf(template, channelOrderNumber, channel)
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["createCourseAppointment"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: content,
					Tag:     "lark_md",
				},
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "退款失败提醒",
				Tag:     "plain_text",
			},
			Template: "blue",
		},
	}
	err := webhook.NewFeiShu(feiShuCfg.GetUrl(), feiShuCfg.GetSign()).SendCard(card)
	if err != nil {
		return err
	}
	return nil
}

// SendRefundCancelAppointmentFeiShuNotify 发送退款需要取消预约的飞书通知
func (r *OrderRepo) SendRefundCancelAppointmentFeiShuNotify(ctx context.Context, channelOrderNumber string) error {
	var template = `**有退款订单，需要手动取消预约**
**订单编号:** %s
`
	var content string
	content = fmt.Sprintf(template, channelOrderNumber)
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["createCourseAppointment"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: content,
					Tag:     "lark_md",
				},
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "退款订单提醒",
				Tag:     "plain_text",
			},
			Template: "red",
		},
	}
	err := webhook.NewFeiShu(feiShuCfg.GetUrl(), feiShuCfg.GetSign()).SendCard(card)
	if err != nil {
		return err
	}
	return nil
}

// MiniProgramPayOrderNotify 小程序支付成功飞书通知
func (r *OrderRepo) MiniProgramPayOrderNotify(ctx context.Context, paymentTime, goodName, actualPrice, paymentPhone string) error {
	var template = `**时间:** %s
**商品:** %s
**实付价格:** %s 元
**支付手机号:** %s
**购买渠道:** 小程序
`
	var content string
	content = fmt.Sprintf(template, paymentTime, goodName, actualPrice, paymentPhone)
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["miniProgramPayOrderNotify"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: content,
					Tag:     "lark_md",
				},
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "小程序支付成功通知",
				Tag:     "plain_text",
			},
			Template: "green",
		},
	}
	err := webhook.NewFeiShu(feiShuCfg.GetUrl(), feiShuCfg.GetSign()).SendCard(card)
	if err != nil {
		return err
	}
	r.log.Infof(fmt.Sprintf("成功发送小程序支付成功飞书通知！支付时间:%s,商品名称:%s,实付价格:%s元,支付手机号:%s", paymentTime, goodName, actualPrice, paymentPhone))
	return nil
}
