package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// SyncUserWxUnionid 用户-微信-unionid同步
func (s *ShadowV1UserWxUseCase) SyncUserWxUnionid(ctx context.Context, req *pb.SyncUserWxUnionidReq) (*pb.SyncUserWxUnionidReply, error) {
	resp := &pb.SyncUserWxUnionidReply{}
	ctx = context.Background()
	go func() {
		userWxList, _, err := s.userWxRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "unionid",
					Value: "",
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			s.log.Errorf("SyncUserWxUnionid userWxRepo.FindMultiCacheByCondition err: %v", err)
			return
		}
		if len(userWxList) == 0 {
			s.log.Errorf("SyncUserWxUnionid userWxList is empty")
			return
		}
		for _, userWx := range userWxList {
			// 如果unionid不为空，则跳过
			if userWx.Unionid != "" {
				s.log.Infof("SyncUserWxUnionid userWx.Unionid is not empty: %s", userWx.Unionid)
				continue
			}
			// 如果offiaccountOpenID为空，则跳过
			if userWx.OffiaccountOpenID == "" {
				s.log.Infof("SyncUserWxUnionid userWx.OffiaccountOpenID is empty: %s", userWx.OffiaccountOpenID)
				continue
			}
			// 需要处理
			userInfo, err := s.officialAccount.User.Get(ctx, userWx.OffiaccountOpenID, "zh_CN")
			if err != nil {
				s.log.Errorf("SyncUserWxUnionid officialAccount.User.Get err: %v", err)
				return
			}
			// 如果unionid为空，则跳过
			if userInfo.UnionID == "" {
				s.log.Infof("SyncUserWxUnionid userInfo.UnionID is empty: %s", userInfo.UnionID)
				continue
			}
			userWx.Unionid = userInfo.UnionID
			oldUserWx := s.userWxRepo.DeepCopy(userWx)
			err = s.userWxRepo.UpdateOneCacheWithZero(ctx, userWx, oldUserWx)
			if err != nil {
				s.log.Errorf("SyncUserWxUnionid userWxRepo.UpdateOneCacheWithZero err: %v", err)
				return
			}
		}
	}()
	return resp, nil
}
