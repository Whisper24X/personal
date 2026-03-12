package data

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.ChannelRepo = (*ChannelRepo)(nil)

func NewChannelRepo(
	logger log.Logger,
	data *Data,
	channelRepo *yanxue_repo.ChannelRepo,
) biz.ChannelRepo {
	l := log.NewHelper(log.With(logger, "module", "data/channel"), log.WithMessageKey("message"))
	return &ChannelRepo{
		log:         l,
		data:        data,
		ChannelRepo: channelRepo,
	}
}

type ChannelRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.ChannelRepo
}

// ChannelIdToName 渠道ID转渠道名称
func (c *ChannelRepo) ChannelIdToName(ctx context.Context) (map[string]string, error) {
	channelIdToName := make(map[string]string)
	channels, _, err := c.ChannelRepo.FindMultiCacheByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, err
	}
	for _, channel := range channels {
		channelIdToName[channel.ID] = channel.Name
	}
	return channelIdToName, nil
}
