package biz

import (
	"context"
	idvalidator "github.com/guanguans/id-validator"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"

	"github.com/forPelevin/gomoji"
	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// StoreUserBindStudent 用户绑定学生-创建一条数据
func (w *WechatV1UserBindStudentUseCase) StoreUserBindStudent(ctx context.Context, req *pb.StoreUserBindStudentReq) (*pb.StoreUserBindStudentReply, error) {
	resp := &pb.StoreUserBindStudentReply{}
	// 验证学生姓名是否包含表情符号
	if gomoji.ContainsEmoji(req.GetStudentName()) {
		return nil, errorx.ParamEmojiInvalid.Err()
	}
	studentIC := ""
	var err error
	// 验证身份证号
	if req.GetStudentIdentityCard() != "" {
		if !idvalidator.IsValid(req.GetStudentIdentityCard(), false) {
			return nil, errorx.ParamIdentityCardInvalid.Err()
		}
		// 加密身份证号
		studentIC, err = cryptutil.YcCardEncrypt(req.GetStudentIdentityCard())
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}

	// 获取用户id
	userId := meta.GetUserID(ctx)
	if userId == "" {
		return nil, errorx.WxUserNotExist.Err()
	}
	if req.GetId() == "" {
		// 查询当前绑定学生的数量
		userBindStudentCount, err := w.userBindStudentRepo.FindMultiCacheByUserID(ctx, userId)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if len(userBindStudentCount) >= 5 {
			return nil, errorx.UserBindStudentLimit.Err()
		}
		// 身份证号是否已存在
		if studentIC != "" {
			userHasBindStudent, _ := lo.Find(userBindStudentCount, func(item *yanxue_model.UserBindStudent) bool {
				return item.StudentIC == studentIC
			})
			if userHasBindStudent != nil {
				return nil, errorx.UserBindStudentICAlreadyExists.Err()
			}
		}
		// 校验姓名是否已存在
		userHasBindStudent, _ := lo.Find(userBindStudentCount, func(item *yanxue_model.UserBindStudent) bool {
			return item.StudentName == req.GetStudentName()
		})
		if userHasBindStudent != nil {
			return nil, errorx.UserBindStudentNameAlreadyExists.Err()
		}
		// 创建
		userBindStudent := &yanxue_model.UserBindStudent{
			UserID:      userId,
			StudentName: req.GetStudentName(),
			StudentIC:   studentIC,
			StudentSex:  req.GetStudentSex(),
			StudentAge:  int16(req.GetStudentAge()),
		}
		err = w.userBindStudentRepo.CreateOneCache(ctx, userBindStudent)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = userBindStudent.ID
	} else {
		// 查询当前绑定学生的数量
		userBindStudentCount, err := w.userBindStudentRepo.FindMultiCacheByUserID(ctx, userId)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		// 过滤掉当前id
		userBindStudentCount = lo.Filter(userBindStudentCount, func(item *yanxue_model.UserBindStudent, _ int) bool {
			return item.ID != req.GetId()
		})
		if len(userBindStudentCount) >= 5 {
			return nil, errorx.UserBindStudentLimit.Err()
		}
		// 身份证号是否已存在
		if studentIC != "" {
			userHasBindStudent, _ := lo.Find(userBindStudentCount, func(item *yanxue_model.UserBindStudent) bool {
				return item.StudentIC == studentIC
			})
			if userHasBindStudent != nil {
				return nil, errorx.UserBindStudentICAlreadyExists.Err()
			}
		}
		// 校验姓名是否已存在
		userHasBindStudent, _ := lo.Find(userBindStudentCount, func(item *yanxue_model.UserBindStudent) bool {
			return item.StudentName == req.GetStudentName()
		})
		if userHasBindStudent != nil {
			return nil, errorx.UserBindStudentNameAlreadyExists.Err()
		}
		// 更新
		userBindStudent, err := w.userBindStudentRepo.FindOneCacheByID(ctx, req.GetId())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		oldUserBindStudent := w.userBindStudentRepo.DeepCopy(userBindStudent)
		userBindStudent.StudentName = req.GetStudentName()
		userBindStudent.StudentSex = req.GetStudentSex()
		userBindStudent.StudentAge = int16(req.GetStudentAge())
		userBindStudent.StudentIC = studentIC
		err = w.userBindStudentRepo.UpdateOneCacheWithZero(ctx, userBindStudent, oldUserBindStudent)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = userBindStudent.ID
	}
	return resp, nil
}
