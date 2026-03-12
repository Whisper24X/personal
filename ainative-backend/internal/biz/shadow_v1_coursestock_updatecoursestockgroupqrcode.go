package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateCourseStockGroupQrCode 课程库存-更新群聊二维码
func (s *ShadowV1CourseStockUseCase) UpdateCourseStockGroupQrCode(ctx context.Context, req *pb.UpdateCourseStockGroupQrCodeReq) (*pb.UpdateCourseStockGroupQrCodeReply, error) {
	resp := &pb.UpdateCourseStockGroupQrCodeReply{}
	adminId := meta.GetAdminID(ctx)
	courseStock, err := s.courseStockRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	oldCourseStock := s.courseStockRepo.DeepCopy(courseStock)
	courseStock.GroupQrCode = req.GetGroupQrCode()
	courseStock.UpdatedBy = adminId
	err = s.courseStockRepo.UpdateOneCacheWithZero(ctx, courseStock, oldCourseStock)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
