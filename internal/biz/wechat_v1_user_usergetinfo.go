package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// UserGetInfo User-获取用户信息
func (w *WechatV1UserUseCase) UserGetInfo(ctx context.Context, req *pb.UserGetInfoReq) (*pb.UserGetInfoReply, error) {
	resp := &pb.UserGetInfoReply{
		UserInfo: &pb.UserInfo{},
	}
	userId := meta.GetUserID(ctx)
	user, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if user == nil || user.ID == "" {
		return resp, nil
	}
	phone, err := cryptutil.YcPhoneDecrypt(user.Ph)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	userAppointmentInfo := &UserAppointmentInfo{}
	if len(user.UserAppointmentInfo) > 0 {
		err = jsonutil.Unmarshal(user.UserAppointmentInfo, userAppointmentInfo)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}

	// 处理监护人信息
	parentInfoList := make([]*pb.ParentInfo, 0)
	if len(user.ParentInfo) > 0 {
		type ParentInfoData struct {
			Id          string `json:"id"`
			ParentName  string `json:"parentName"`
			ParentSex   string `json:"parentSex"`
			ParentPhone string `json:"parentPhone"`
		}

		var storedParentInfo []*ParentInfoData
		err = jsonutil.Unmarshal(user.ParentInfo, &storedParentInfo)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}

		// 解密监护人信息
		for _, parentData := range storedParentInfo {
			// 解密手机号
			decryptedPhone, err := cryptutil.YcPhoneDecrypt(parentData.ParentPhone)
			if err != nil {
				w.log.Warnf("监护人手机号解密失败: %v", err)
				continue
			}

			parentInfoList = append(parentInfoList, &pb.ParentInfo{
				Id:          parentData.Id,
				ParentName:  parentData.ParentName,
				ParentSex:   parentData.ParentSex,
				ParentPhone: decryptedPhone,
			})
		}
	}
	resp.UserInfo = &pb.UserInfo{
		Id:         user.ID,
		Phone:      phone,
		Nickname:   user.Nickname,
		Avatar:     user.Avatar,
		Status:     int32(user.Status),
		CreatedAt:  timeutil.RFC3339(user.CreatedAt),
		UpdatedAt:  timeutil.RFC3339(user.UpdatedAt),
		UserWxInfo: &pb.UserWxInfo{},
		UserAppointmentInfo: &pb.UserAppointmentInfo{
			ParentName:      userAppointmentInfo.ParentName,
			ParentPhone:     userAppointmentInfo.ParentPhone,
			ParentAccompany: userAppointmentInfo.ParentAccompany,
		},
		ParentInfo: parentInfoList, // 添加监护人信息
	}
	userWx, err := w.userWxRepo.FindOneCacheByID(ctx, user.UserWxID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if userWx == nil || userWx.ID == "" {
		return resp, nil
	}
	resp.UserInfo.UserWxInfo = &pb.UserWxInfo{
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
	}
	return resp, nil
}
