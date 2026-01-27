package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteCourseStock -删除多条数据
func (s *ShadowV1CourseStockUseCase) DeleteCourseStock(ctx context.Context, req *pb.DeleteCourseStockReq) (*pb.DeleteCourseStockReply, error) {
	resp := &pb.DeleteCourseStockReply{}
	err := s.courseStockRepo.DeleteMultiCacheByIDS(ctx, req.GetIds())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
