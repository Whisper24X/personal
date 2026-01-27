package rpc

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-resty/resty/v2"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/restry"
)

func NewSmsNotifyHttpRpc(logger log.Logger, cfg *conf.Bootstrap, restyClient *resty.Client) *SmsNotifyHttpRpc {
	l := log.NewHelper(log.With(logger, "module", "data/rpc"), log.WithMessageKey("message"))
	return &SmsNotifyHttpRpc{
		log:         l,
		cfg:         cfg,
		restyClient: restyClient,
	}
}

type SmsNotifyHttpRpc struct {
	log         *log.Helper
	cfg         *conf.Bootstrap
	restyClient *resty.Client
}

type SendSmsReq struct {
	Phone       []string          `json:"phone"`
	Template    string            `json:"template"`
	FromService string            `json:"fromService"`
	Params      map[string]string `json:"params"`
}

type SendSmsReply struct {
	Status bool `json:"status"`
}

func (s *SmsNotifyHttpRpc) SendSms(ctx context.Context, param *SendSmsReq) error {
	resp := SendSmsReply{}
	curl := "http://smsnotify.backsys/sendMessage"
	result, err := s.restyClient.R().SetBody(param).EnableTrace().SetResult(resp).Post(curl)
	if err != nil || result.StatusCode() != http.StatusOK {
		s.log.WithContext(ctx).Errorf("SendSms send http param %+v err %v", param, err)
		return err
	}
	err = restry.CheckStatus(result)
	if err != nil {
		s.log.WithContext(ctx).Errorf("SendSms send http param %+v err %v", param, err)
		return err
	}
	return nil
}
