package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserBindStudentList 用户绑定学生-列表数据查询
func (s *ShadowV1UserBindStudentUseCase) GetUserBindStudentList(ctx context.Context, req *pb.GetUserBindStudentListReq) (*pb.GetUserBindStudentListReply, error) {
	resp := &pb.GetUserBindStudentListReply{
		List: []*pb.UserBindStudentInfo{},
	}
	userBindStudentList, err := s.userBindStudentRepo.FindMultiCacheByUserID(ctx, req.GetUserId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, userBindStudent := range userBindStudentList {
		studentIdentityCard := ""
		if userBindStudent.StudentIC != "" {
			studentIdentityCard, err = cryptutil.YcCardDecrypt(userBindStudent.StudentIC)
			if err != nil {
				return resp, errorx.DataEncryptErr.WithError(err).Err()
			}
		}
		resp.List = append(resp.List, &pb.UserBindStudentInfo{
			Id:                  userBindStudent.ID,
			UserId:              userBindStudent.UserID,
			StudentName:         userBindStudent.StudentName,
			StudentIdentityCard: studentIdentityCard,
			StudentSex:          userBindStudent.StudentSex,
			StudentAge:          int32(userBindStudent.StudentAge),
			CreatedAt:           timeutil.RFC3339(userBindStudent.CreatedAt),
			UpdatedAt:           timeutil.RFC3339(userBindStudent.UpdatedAt),
		})
	}
	return resp, nil
}
