package biz

import (
	"context"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserBindStudentInfo 用户绑定学生-单条数据查询
func (s *ShadowV1UserBindStudentUseCase) GetUserBindStudentInfo(ctx context.Context, req *pb.GetUserBindStudentInfoReq) (*pb.GetUserBindStudentInfoReply, error) {
	resp := &pb.GetUserBindStudentInfoReply{
		Info: &pb.UserBindStudentInfo{},
	}
	userBindStudent, err := s.userBindStudentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if userBindStudent == nil || userBindStudent.ID == "" {
		return resp, errorx.DataRecordNotFound.Err()
	}
	studentIdentityCard := ""
	if userBindStudent.StudentIC != "" {
		studentIdentityCard, err = cryptutil.YcCardDecrypt(userBindStudent.StudentIC)
		if err != nil {
			return resp, errorx.DataEncryptErr.WithError(err).Err()
		}
	}
	resp.Info = &pb.UserBindStudentInfo{
		Id:                  userBindStudent.ID,
		UserId:              userBindStudent.UserID,
		StudentName:         userBindStudent.StudentName,
		StudentIdentityCard: studentIdentityCard,
		StudentSex:          userBindStudent.StudentSex,
		StudentAge:          int32(userBindStudent.StudentAge),
		CreatedAt:           timeutil.RFC3339(userBindStudent.CreatedAt),
		UpdatedAt:           timeutil.RFC3339(userBindStudent.UpdatedAt),
	}
	return resp, nil
}
