package biz

import (
	"context"
	"sort"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetCourseAppointmentList 课程-查询课程预约记录
func (w *WechatV1CourseUseCase) GetCourseAppointmentList(ctx context.Context, req *pb.GetCourseAppointmentListReq) (*pb.GetCourseAppointmentListReply, error) {
	resp := &pb.GetCourseAppointmentListReply{
		Total: 0,
		List:  []*pb.CourseAppointmentInfo{},
	}
	// 获取用户 Id
	userId := meta.GetUserID(ctx)
	userInfo, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询所有的订单
	orderList, err := w.orderRepo.FindMultiCacheByPh(ctx, userInfo.Ph)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	orderIds := lo.Map(orderList, func(item *yanxue_model.Order, _ int) string {
		return item.ID
	})
	// 查询所有的课程预约记录
	courseAppointmentList, err := w.courseAppointmentRepo.FindMultiCacheByOrderIDS(ctx, orderIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 只需要已预约和已完成的
	courseAppointmentList = lo.Filter(courseAppointmentList, func(item *yanxue_model.CourseAppointment, _ int) bool {
		if req.GetStatus() == "" {
			return item.Status == constant.CourseAppointmentStatusSuccess.String() || item.Status == constant.CourseAppointmentStatusCompleted.String()
		}
		return item.Status == req.GetStatus()
	})
	// 按照已预约，已完成的排序，剩下的按时间倒序
	// success // 已预约
	// completed // 已完成
	// 定义订单状态优先级
	statusPriority := map[string]int{
		"success":   0, // 已预约
		"completed": 1, // 已完成
	}
	// 按状态优先级和时间排序
	sort.Slice(courseAppointmentList, func(i, j int) bool {
		// 首先按状态优先级排序
		if statusPriority[string(courseAppointmentList[i].Status)] != statusPriority[string(courseAppointmentList[j].Status)] {
			return statusPriority[string(courseAppointmentList[i].Status)] < statusPriority[string(courseAppointmentList[j].Status)]
		}
		// 状态相同时，按创建时间倒序排序
		return courseAppointmentList[i].CreatedAt.After(courseAppointmentList[j].CreatedAt)
	})
	resp.Total = int32(len(courseAppointmentList))
	// 手动分页逻辑
	start := (req.GetPage() - 1) * req.GetPageSize()
	end := start + req.GetPageSize()
	if end > int32(len(courseAppointmentList)) {
		end = int32(len(courseAppointmentList))
	}
	list := courseAppointmentList[start:end]
	goodIds := make([]string, 0)
	courseIds := make([]string, 0)
	for _, v := range list {
		goodIds = append(goodIds, v.GoodID)
		courseIds = append(courseIds, v.CourseID)
	}
	goodIdToName, err := w.goodRepo.GoodIdToName(ctx, goodIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseIdToName, err := w.courseRepo.CourseIdToName(ctx, courseIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, v := range list {
		studentIdentityCard := ""
		if v.StudentIC != "" {
			studentIdentityCard, err = cryptutil.YcCardDecrypt(v.StudentIC)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
		}
		parentPhone, err := cryptutil.YcPhoneDecrypt(v.ParentPh)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
		courseStock, err := w.courseStockRepo.FindOneByCourseIDDatePeriod(ctx, v.CourseID, v.Date, v.Period)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		courseType := ""
		groupQrCode := ""
		if courseStock != nil {
			courseType = courseStock.CourseType
			groupQrCode = courseStock.GroupQrCode
		}
		resp.List = append(resp.List, &pb.CourseAppointmentInfo{
			Id:                  v.ID,
			OrderId:             v.OrderID,
			GoodId:              v.GoodID,
			CourseId:            v.CourseID,
			Date:                v.Date,
			Period:              v.Period,
			StudentName:         v.StudentName,
			StudentIdentityCard: studentIdentityCard,
			StudentSex:          v.StudentSex,
			StudentAge:          0,
			ParentName:          v.ParentName,
			ParentPhone:         parentPhone,
			ParentAccompany:     v.ParentAccompany,
			VerificationCode:    v.VerificationCode,
			Status:              v.Status,
			CreatedAt:           timeutil.RFC3339(v.CreatedAt),
			UpdatedAt:           timeutil.RFC3339(v.UpdatedAt),
			GoodName:            goodIdToName[v.GoodID],
			CourseName:          courseIdToName[v.CourseID],
			CourseType:          courseType,
			GroupQrCode:         groupQrCode,
		})
	}
	return resp, nil
}
