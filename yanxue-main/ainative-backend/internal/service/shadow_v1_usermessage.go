package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1UserMessageService(
	logger log.Logger,
	shadowV1UserMessageUseCase *biz.ShadowV1UserMessageUseCase,
) *ShadowV1UserMessageService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1UserMessage"), log.WithMessageKey("message"))
	return &ShadowV1UserMessageService{
		log:                        l,
		shadowV1UserMessageUseCase: shadowV1UserMessageUseCase,
	}
}

type ShadowV1UserMessageService struct {
	pb.UnimplementedUserMessageServer
	log                        *log.Helper
	shadowV1UserMessageUseCase *biz.ShadowV1UserMessageUseCase
}

// CreateUserMessage 用户-消息-创建一条数据
func (s *ShadowV1UserMessageService) CreateUserMessage(ctx context.Context, req *pb.CreateUserMessageReq) (*pb.CreateUserMessageReply, error) {
	return s.shadowV1UserMessageUseCase.CreateUserMessage(ctx, req)
}

// UpdateUserMessage 用户-消息-更新一条数据
func (s *ShadowV1UserMessageService) UpdateUserMessage(ctx context.Context, req *pb.UpdateUserMessageReq) (*pb.UpdateUserMessageReply, error) {
	return s.shadowV1UserMessageUseCase.UpdateUserMessage(ctx, req)
}

// DeleteUserMessage 用户-消息-删除多条数据
func (s *ShadowV1UserMessageService) DeleteUserMessage(ctx context.Context, req *pb.DeleteUserMessageReq) (*pb.DeleteUserMessageReply, error) {
	return s.shadowV1UserMessageUseCase.DeleteUserMessage(ctx, req)
}

// GetUserMessageInfo 用户-消息-单条数据查询
func (s *ShadowV1UserMessageService) GetUserMessageInfo(ctx context.Context, req *pb.GetUserMessageInfoReq) (*pb.GetUserMessageInfoReply, error) {
	return s.shadowV1UserMessageUseCase.GetUserMessageInfo(ctx, req)
}

// GetUserMessageList 用户-消息-列表数据查询
func (s *ShadowV1UserMessageService) GetUserMessageList(ctx context.Context, req *pb.GetUserMessageListReq) (*pb.GetUserMessageListReply, error) {
	return s.shadowV1UserMessageUseCase.GetUserMessageList(ctx, req)
}
