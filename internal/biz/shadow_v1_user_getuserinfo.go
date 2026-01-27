package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserInfo 用户-详情数据查询
func (s *ShadowV1UserUseCase) GetUserInfo(ctx context.Context, req *pb.GetUserInfoReq) (*pb.GetUserInfoReply, error) {
	resp := &pb.GetUserInfoReply{
		UserInfo: &pb.UserInfo{},
	}
	userInfo, err := s.userRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	// 解密手机号
	phone, err := cryptutil.YcPhoneDecrypt(userInfo.Ph)
	if err != nil {
		return nil, errorx.DataEncryptErr.WithError(err).Err()
	}
	u := pb.UserInfo{
		Id:         userInfo.ID,
		Phone:      phone,
		Nickname:   userInfo.Nickname,
		Avatar:     userInfo.Avatar,
		Address:    userInfo.Address,
		Birthday:   userInfo.Birthday,
		Status:     int32(userInfo.Status),
		CreatedAt:  timeutil.RFC3339(userInfo.CreatedAt),
		UpdatedAt:  timeutil.RFC3339(userInfo.UpdatedAt),
		UserWxInfo: &pb.UserWxInfo{},
	}
	if userInfo.UserWxID != "" {
		userWx, err := s.userWxRepo.FindOneCacheByID(ctx, userInfo.UserWxID)
		if err != nil {
			return nil, err
		}
		u.UserWxInfo = &pb.UserWxInfo{
			Id:                userWx.ID,
			Unionid:           userWx.Unionid,
			OffiaccountOpenId: userWx.OffiaccountOpenID,
			OffiaccountFollow: userWx.OffiaccountFollow,
			Status:            int32(userWx.Status),
			CreatedAt:         timeutil.RFC3339(userWx.CreatedAt),
			UpdatedAt:         timeutil.RFC3339(userWx.UpdatedAt),
			Nickname:          userWx.Nickname,
			Sex:               int32(userWx.Sex),
			Province:          userWx.Province,
			City:              userWx.City,
			Country:           userWx.Country,
			Headimgurl:        userWx.Headimgurl,
			MiniprogramOpenId: userWx.MiniprogramOpenID,
		}
	}
	resp.UserInfo = &u
	return resp, nil
}
