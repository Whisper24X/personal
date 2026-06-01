package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserList 用户-列表数据查询
func (s *ShadowV1UserUseCase) GetUserList(ctx context.Context, req *pb.GetUserListReq) (*pb.GetUserListReply, error) {
	resp := &pb.GetUserListReply{}
	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetPhone() != "" {
		phone, err := cryptutil.YcPhoneItemEncrypt(req.GetPhone())
		if err != nil {
			return nil, errorx.DataEncryptErr.WithError(err).Err()
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "ph",
			Value: "%" + phone + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	users, p, err := s.userRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = int32(p.Total)
	if len(users) > 0 {
		userWxIds := make([]string, 0)
		for _, v := range users {
			if v.UserWxID != "" {
				userWxIds = append(userWxIds, v.UserWxID)
			}
		}
		userWxs, err := s.userWxRepo.FindMultiCacheByIDS(ctx, userWxIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		userWxMap := make(map[string]*yanxue_model.UserWx)
		for _, v := range userWxs {
			userWxMap[v.ID] = v
		}
		for _, v := range users {
			phone, err := cryptutil.YcPhoneDecrypt(v.Ph)
			if err != nil {
				return nil, errorx.DataEncryptErr.WithError(err).Err()
			}
			userInfo := &pb.UserInfo{
				Id:         v.ID,
				Phone:      phone,
				Nickname:   v.Nickname,
				Avatar:     v.Avatar,
				Address:    v.Address,
				Birthday:   v.Birthday,
				Status:     int32(v.Status),
				CreatedAt:  timeutil.RFC3339(v.CreatedAt),
				UpdatedAt:  timeutil.RFC3339(v.UpdatedAt),
				UserWxInfo: &pb.UserWxInfo{},
			}
			if userWx, ok := userWxMap[v.UserWxID]; ok {
				userInfo.UserWxInfo = &pb.UserWxInfo{
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
			resp.List = append(resp.List, userInfo)
		}
	}
	return resp, nil
}
