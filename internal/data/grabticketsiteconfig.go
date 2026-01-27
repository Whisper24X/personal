package data

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/webhook"
)

var _ biz.GrabTicketSiteConfigRepo = (*GrabTicketSiteConfigRepo)(nil)

func NewGrabTicketSiteConfigRepo(
	logger log.Logger,
	data *Data,
	grabTicketSiteConfigRepo *yanxue_repo.GrabTicketSiteConfigRepo,
	cfg *conf.Bootstrap,
) biz.GrabTicketSiteConfigRepo {
	l := log.NewHelper(log.With(logger, "module", "data/grabTicketSiteConfig"), log.WithMessageKey("message"))
	return &GrabTicketSiteConfigRepo{
		log:                      l,
		data:                     data,
		GrabTicketSiteConfigRepo: grabTicketSiteConfigRepo,
		cfg:                      cfg,
	}
}

type GrabTicketSiteConfigRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.GrabTicketSiteConfigRepo
	cfg *conf.Bootstrap
}

// ScanCodeForGrabTicketFeiShuNotify 扫码抢票登录飞书通知
func (r *GrabTicketSiteConfigRepo) ScanCodeForGrabTicketFeiShuNotify(ctx context.Context, content, imgKey string) error {
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["scanCodeForGrabTicketNotify"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: content,
					Tag:     "lark_md",
				},
			},
			{
				Tag:    "img",
				ImgKey: imgKey,
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "扫码登录通知",
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
