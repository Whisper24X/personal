package biz

import (
	"context"

	"github.com/forPelevin/gomoji"
	idvalidator "github.com/guanguans/id-validator"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// CreateUserBindStudent 用户绑定学生-创建一条数据
func (s *ShadowV1UserBindStudentUseCase) CreateUserBindStudent(ctx context.Context, req *pb.CreateUserBindStudentReq) (*pb.CreateUserBindStudentReply, error) {
	resp := &pb.CreateUserBindStudentReply{
		Id: "",
	}
	// 验证学生姓名是否包含表情符号
	if gomoji.ContainsEmoji(req.GetStudentName()) {
		return nil, errorx.ParamEmojiInvalid.Err()
	}
	// 验证身份证号
	if req.GetStudentIdentityCard() != "" {
		if !idvalidator.IsValid(req.GetStudentIdentityCard(), false) {
			return nil, errorx.ParamIdentityCardInvalid.Err()
		}
	}
	// 校验用户ID是否存在
	userInfo, err := s.userRepo.FindOneCacheByID(ctx, req.GetUserId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if userInfo == nil || userInfo.ID == "" {
		return resp, errorx.UserNotExists.Err()
	}
	studentIC := ""
	if req.GetStudentIdentityCard() != "" {
		studentIC, err = cryptutil.YcCardEncrypt(req.GetStudentIdentityCard())
		if err != nil {
			return resp, errorx.DataEncryptErr.WithError(err).Err()
		}
	}
	userBindStudent := &yanxue_model.UserBindStudent{
		UserID:      req.GetUserId(),
		StudentName: req.GetStudentName(),
		StudentIC:   studentIC,
		StudentSex:  req.GetStudentSex(),
		StudentAge:  int16(req.GetStudentAge()),
	}
	err = s.userBindStudentRepo.CreateOneCache(ctx, userBindStudent)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
