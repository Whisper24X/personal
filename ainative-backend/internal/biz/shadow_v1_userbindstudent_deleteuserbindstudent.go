package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteUserBindStudent 用户绑定学生-删除多条数据
func (s *ShadowV1UserBindStudentUseCase) DeleteUserBindStudent(ctx context.Context, req *pb.DeleteUserBindStudentReq) (*pb.DeleteUserBindStudentReply, error) {
	resp := &pb.DeleteUserBindStudentReply{}
	// 校验用户ID是否存在
	err := s.userBindStudentRepo.DeleteMultiCacheByIDS(ctx, req.GetIds())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
