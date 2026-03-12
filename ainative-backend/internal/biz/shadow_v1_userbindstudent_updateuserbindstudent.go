package biz

import (
	"context"

	"github.com/forPelevin/gomoji"
	idvalidator "github.com/guanguans/id-validator"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// UpdateUserBindStudent 用户绑定学生-更新一条数据
func (s *ShadowV1UserBindStudentUseCase) UpdateUserBindStudent(ctx context.Context, req *pb.UpdateUserBindStudentReq) (*pb.UpdateUserBindStudentReply, error) {
	resp := &pb.UpdateUserBindStudentReply{}
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
	userBindStudent, err := s.userBindStudentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if userBindStudent == nil || userBindStudent.ID == "" {
		return resp, errorx.DataRecordNotFound.Err()
	}
	studentIC := ""
	if req.GetStudentIdentityCard() != "" {
		studentIC, err = cryptutil.YcCardEncrypt(req.GetStudentIdentityCard())
		if err != nil {
			return resp, errorx.DataEncryptErr.WithError(err).Err()
		}
	}
	oldUserBindStudent := s.userBindStudentRepo.DeepCopy(userBindStudent)
	oldUserBindStudent.StudentName = req.GetStudentName()
	oldUserBindStudent.StudentIC = studentIC
	oldUserBindStudent.StudentSex = req.GetStudentSex()
	oldUserBindStudent.StudentAge = int16(req.GetStudentAge())
	err = s.userBindStudentRepo.UpdateOneCache(ctx, userBindStudent, oldUserBindStudent)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
