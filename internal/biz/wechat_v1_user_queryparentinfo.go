package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// QueryParentInfo User-查询监护人信息
func (w *WechatV1UserUseCase) QueryParentInfo(ctx context.Context, req *pb.QueryParentInfoReq) (*pb.QueryParentInfoReply, error) {
	resp := &pb.QueryParentInfoReply{
		ParentInfo: make([]*pb.ParentInfo, 0),
	}

	// 获取用户ID
	userId := meta.GetUserID(ctx)
	if userId == "" {
		return nil, errorx.TokenNotRequest.Err()
	}

	// 查询用户信息
	user, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if user == nil || user.ID == "" {
		return nil, errors.New(http.StatusBadRequest, "-1", "用户不存在")
	}

	w.log.Infof("查询用户监护人信息: userId=%s", userId)

	// 检查是否有监护人信息
	if len(user.ParentInfo) == 0 {
		w.log.Infof("用户暂无监护人信息: userId=%s", userId)
		return resp, nil
	}

	// 反序列化监护人信息
	type ParentInfoData struct {
		Id          string `json:"id"` // id
		ParentName  string `json:"parentName"`
		ParentSex   string `json:"parentSex"`
		ParentPhone string `json:"parentPhone"`
	}

	var storedParentInfo []*ParentInfoData
	err = jsonutil.Unmarshal(user.ParentInfo, &storedParentInfo)
	if err != nil {
		w.log.Errorf("反序列化监护人信息失败: userId=%s, err=%v", userId, err)
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}

	// 解密并转换监护人信息
	for i, parentData := range storedParentInfo {
		// 解密手机号
		decryptedPhone, err := cryptutil.YcPhoneDecrypt(parentData.ParentPhone)
		if err != nil {
			w.log.Errorf("监护人手机号解密失败: userId=%s, index=%d, err=%v", userId, i, err)
			// 手机号解密失败，跳过这条记录
			continue
		}

		// 添加到响应列表
		resp.ParentInfo = append(resp.ParentInfo, &pb.ParentInfo{
			Id:          parentData.Id,
			ParentName:  parentData.ParentName,
			ParentSex:   parentData.ParentSex,
			ParentPhone: decryptedPhone,
		})

		w.log.Infof("成功解密监护人信息[%d]: 姓名=%s, 手机号=%s", i+1, parentData.ParentName, decryptedPhone)
	}

	w.log.Infof("成功查询用户监护人信息: userId=%s, 监护人数量=%d", userId, len(resp.ParentInfo))

	return resp, nil
}
