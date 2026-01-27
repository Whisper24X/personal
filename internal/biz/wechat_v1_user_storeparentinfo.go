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
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/validutil"
)

// ParentInfoData 监护人信息数据结构，用于JSON存储
type ParentInfoData struct {
	Id          string `json:"id"`          // id
	ParentName  string `json:"parentName"`  // 家长-姓名
	ParentSex   string `json:"parentSex"`   // 家长-性别 男M 女F
	ParentPhone string `json:"parentPhone"` // 家长-手机号
}

// StoreParentInfo User-更新监护人信息
func (w *WechatV1UserUseCase) StoreParentInfo(ctx context.Context, req *pb.StoreParentInfoReq) (*pb.StoreParentInfoReply, error) {
	resp := &pb.StoreParentInfoReply{}

	userId := meta.GetUserID(ctx)

	// 参数验证：检查监护人信息列表
	if len(req.GetParentInfo()) == 0 {
		return nil, errors.New(http.StatusBadRequest, "-1", "监护人信息不能为空")
	}

	// 验证每个监护人信息的必填字段和格式
	for i, parentInfo := range req.GetParentInfo() {
		// 验证姓名
		if parentInfo.GetParentName() == "" {
			return nil, errors.New(http.StatusBadRequest, "-1", "监护人姓名不能为空")
		}

		// 验证手机号
		if parentInfo.GetParentPhone() == "" {
			return nil, errors.New(http.StatusBadRequest, "-1", "监护人手机号不能为空")
		}
		if !validutil.IsPhoneLoose(parentInfo.GetParentPhone()) {
			return nil, errors.New(http.StatusBadRequest, "-1", "监护人手机号格式不正确")
		}

		// 验证性别
		if parentInfo.GetParentSex() != "" {
			if parentInfo.GetParentSex() != "M" && parentInfo.GetParentSex() != "F" {
				return nil, errors.New(http.StatusBadRequest, "-1", "监护人性别只能为M（男）或F（女）")
			}
		}

		w.log.Infof("验证监护人信息[%d]: 姓名=%s, 手机号=%s", i+1, parentInfo.GetParentName(), parentInfo.GetParentPhone())
	}

	// 查询用户信息
	user, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if user == nil || user.ID == "" {
		return nil, errors.New(http.StatusConflict, "-1", "用户不存在")
	}

	// 数据转换：将protobuf格式转换为JSON存储格式
	parentInfoList := make([]*ParentInfoData, 0, len(req.GetParentInfo()))
	for _, parentInfo := range req.GetParentInfo() {
		// 手机号加密处理
		encryptedPhone, err := cryptutil.YcPhoneEncrypt(parentInfo.GetParentPhone())
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}

		parentInfoList = append(parentInfoList, &ParentInfoData{
			Id:          parentInfo.GetId(),
			ParentName:  parentInfo.GetParentName(),
			ParentSex:   parentInfo.GetParentSex(),
			ParentPhone: encryptedPhone,
		})
	}

	// 将监护人信息序列化为JSON
	parentInfoJson, err := jsonutil.Marshal(parentInfoList)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}

	// 数据库操作：更新用户监护人信息
	oldUser := w.userRepo.DeepCopy(user)
	user.ParentInfo = parentInfoJson

	err = w.userRepo.UpdateOneCacheWithZero(ctx, user, oldUser)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	w.log.Infof("成功更新用户监护人信息: userId=%s, 监护人数量=%d", userId, len(parentInfoList))

	return resp, nil
}
