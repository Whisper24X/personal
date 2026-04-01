package biz

import (
	"context"
	"strings"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// CreateChannel 渠道-创建
func (s *ShadowV1ChannelUseCase) CreateChannel(ctx context.Context, req *pb.CreateChannelReq) (*pb.CreateChannelReply, error) {
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, errorx.ParamValidationErr.Err()
	}
	exists, err := s.channelRepo.ExistsByName(ctx, name)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if exists {
		return nil, errorx.ChannelDuplicateName.Err()
	}
	channel := &yanxue_model.Channel{
		Name:                 name,
		VerificationCodeType: "none",
	}
	if err := s.channelRepo.CreateOneCache(ctx, channel); err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	err = s.dynamicFieldMappingRepo.CopyFromChannel(ctx, constant.ChannelTypeWD, name)
	if err != nil {
		s.log.Warnf("CreateChannel: 复制微店 dynamic_field_mapping 失败, channel=%s, err=%v", name, err)
	}
	return &pb.CreateChannelReply{Id: channel.ID}, nil
}
