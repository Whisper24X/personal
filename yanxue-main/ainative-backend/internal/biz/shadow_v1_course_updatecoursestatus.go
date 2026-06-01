package biz

import (
	"context"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateCourseStatus 课程-信息-更新状态
func (s *ShadowV1CourseUseCase) UpdateCourseStatus(ctx context.Context, req *pb.UpdateCourseStatusReq) (*pb.UpdateCourseStatusReply, error) {
	resp := &pb.UpdateCourseStatusReply{}
	adminId := meta.GetAdminID(ctx)
	courseList, err := s.courseRepo.FindMultiCacheByIDS(ctx, req.GetIds())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(courseList) == 0 {
		return nil, errorx.DataRecordNotFound.Err()
	}
	if req.GetStatus() == constant.CourseStatusPutOn.String() {
		// 上架
		// 校验库存是否设置
		for _, course := range courseList {
			// 查询当前是否有配置库存
			courseStock, err := s.courseStockRepo.FindMultiCacheByCourseID(ctx, course.ID)
			if err != nil {
				return nil, errorx.DataSQLErr.WithError(err).Err()
			}
			// 过滤掉已下架的库存
			courseStock = lo.Filter(courseStock, func(item *yanxue_model.CourseStock, _ int) bool {
				return item.Status == constant.CourseStockStatusPutOn.String()
			})
			// 校验库存是否设置
			if len(courseStock) == 0 {
				return nil, errorx.CourseStockNotSet.WithFmtMsg(course.CourseName).Err()
			}
		}
	} else {
		// 下架
		for _, course := range courseList {
			goodIds, err := s.goodRepo.HasCourseGoodIds(ctx, course.ID)
			if err != nil {
				return nil, errorx.DataSQLErr.WithError(err).Err()
			}
			if len(goodIds) > 0 {
				return nil, errorx.CourseHasGood.WithFmtMsg(course.CourseName).Err()
			}
		}
	}
	err = s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		for _, course := range courseList {
			// 更新状态
			oldCourse := s.courseRepo.DeepCopy(course)
			course.Status = req.GetStatus()
			course.UpdatedBy = adminId
			err = s.courseRepo.UpdateOneCacheWithZeroByTx(ctx, tx, course, oldCourse)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
