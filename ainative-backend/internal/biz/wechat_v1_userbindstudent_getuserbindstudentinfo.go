package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserBindStudentInfo 用户绑定学生-单条数据查询
func (w *WechatV1UserBindStudentUseCase) GetUserBindStudentInfo(ctx context.Context, req *pb.GetUserBindStudentInfoReq) (*pb.GetUserBindStudentInfoReply, error) {
	resp := &pb.GetUserBindStudentInfoReply{}
	userId := meta.GetUserID(ctx)
	userBindStudent, err := w.userBindStudentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if userBindStudent == nil || userBindStudent.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	if userBindStudent.UserID != userId {
		return nil, errorx.UserNoPermission.Err()
	}
	studentIdentityCard := ""
	if userBindStudent.StudentIC != "" {
		studentIdentityCard, err = cryptutil.YcCardDecrypt(userBindStudent.StudentIC)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}

	resp.Info = &pb.UserBindStudentInfo{
		Id:                  userBindStudent.ID,
		StudentIdentityCard: studentIdentityCard,
		StudentName:         userBindStudent.StudentName,
		StudentSex:          userBindStudent.StudentSex,
		StudentAge:          int32(userBindStudent.StudentAge),
		CreatedAt:           timeutil.RFC3339(userBindStudent.CreatedAt),
		UpdatedAt:           timeutil.RFC3339(userBindStudent.UpdatedAt),
	}
	return resp, nil
}
