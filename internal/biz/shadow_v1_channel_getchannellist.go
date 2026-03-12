package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetChannelList 渠道-列表数据查询
func (s *ShadowV1ChannelUseCase) GetChannelList(ctx context.Context, req *pb.GetChannelListReq) (*pb.GetChannelListReply, error) {
	resp := &pb.GetChannelListReply{}
	param := &condition.Req{
		Query: []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}

	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, channel := range channelList {
		resp.List = append(resp.List, &pb.ChannelInfo{
			Id:                   channel.ID,
			Name:                 channel.Name,
			VerificationCodeType: channel.VerificationCodeType,
		})
	}
	return resp, nil
}
