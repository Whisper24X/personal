package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// DeleteUserBindStudent 用户绑定学生-删除多条数据
func (w *WechatV1UserBindStudentUseCase) DeleteUserBindStudent(ctx context.Context, req *pb.DeleteUserBindStudentReq) (*pb.DeleteUserBindStudentReply, error) {
	resp := &pb.DeleteUserBindStudentReply{}
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
	err = w.userBindStudentRepo.DeleteOneCacheByID(ctx, userBindStudent.ID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
