package biz

import (
	"context"
	"fmt"
	"strconv"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	ctxn "gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/ctx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// ExportCourseAppointmentList 课程-预约-列表数据导出
func (s *ShadowV1CourseAppointmentUseCase) ExportCourseAppointmentList(ctx context.Context, req *pb.ExportCourseAppointmentListReq) (*pb.ExportCourseAppointmentListReply, error) {
	resp := &pb.ExportCourseAppointmentListReply{}
	key := cryptutil.Sha256(req.String())
	filePath := fmt.Sprintf("./tmp/course_appointment_list_%s.csv", key)
	neverDoneCtx := ctxn.NewNeverDoneCtx(ctx)
	downloadUrl, err := s.bffRepo.QueryAndUploadCSV(neverDoneCtx, key, filePath, func() ([][]string, error) {
		param := &condition.Req{
			Query: []*condition.QueryParam{},
			Order: []*condition.OrderParam{
				{
					Field: "updatedAt",
					Order: condition.DESC,
				},
			},
		}
		if req.GetCourseId() != "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			})
		}
		if req.GetStartDate() != "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "date",
				Value: req.GetStartDate(),
				Exp:   condition.GTE,
				Logic: condition.AND,
			})
		}
		if req.GetEndDate() != "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "date",
				Value: req.GetEndDate(),
				Exp:   condition.LTE,
				Logic: condition.AND,
			})
		}
		if req.GetStudentName() != "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "studentName",
				Value: "%" + req.GetStudentName() + "%",
				Exp:   condition.LIKE,
				Logic: condition.AND,
			})
		}
		if req.GetParentName() != "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "parentName",
				Value: "%" + req.GetParentName() + "%",
				Exp:   condition.LIKE,
				Logic: condition.AND,
			})
		}
		if req.GetParentPhone() != "" {
			parentPh, err := cryptutil.YcPhoneItemEncrypt(req.GetParentPhone())
			if err != nil {
				return nil, errorx.DataSQLErr.WithError(err).Err()
			}
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "parentPh",
				Value: "%" + parentPh + "%",
				Exp:   condition.LIKE,
				Logic: condition.AND,
			})
		}
		if req.GetStatus() != "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "status",
				Value: req.GetStatus(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			})
		}
		list, _, err := s.courseAppointmentRepo.FindMultiCacheByCondition(neverDoneCtx, param)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if len(list) == 0 {
			return nil, nil
		}
		csvData := make([][]string, 0)
		csvData = append(csvData, []string{
			"预约编号",
			"订单编号",
			"渠道订单编号",
			"课程名称",
			"课程日期",
			"课程时间",
			"孩子姓名",
			"身份证号",
			"年龄",
			"性别",
			"家长姓名",
			"家长手机号",
			"家长是否同行",
			"核销券码",
			"用户备注",
			"业务备注",
			"实收金额",
			"创建时间",
			"更新时间",
			"最后编辑人",
			"状态",
		})
		// 先查询必要数据
		adminIds := make([]string, 0)
		courseIds := make([]string, 0)
		goodIds := make([]string, 0)
		orderIds := make([]string, 0)
		for _, courseStock := range list {
			adminIds = append(adminIds, courseStock.UpdatedBy)
			courseIds = append(courseIds, courseStock.CourseID)
			goodIds = append(goodIds, courseStock.GoodID)
			orderIds = append(orderIds, courseStock.OrderID)
		}
		adminMap, err := s.sysAdminRepo.AdminIdToName(neverDoneCtx, adminIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		courseIdToName, err := s.courseRepo.CourseIdToName(neverDoneCtx, courseIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		goodMap, err := s.goodRepo.GoodIdToName(neverDoneCtx, goodIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		orderNumberMap, err := s.orderRepo.OrderIdToOrderNumber(neverDoneCtx, orderIds)
		if err != nil {
			return nil, err
		}
		orderIdToReceiptMap, err := s.GetReceiptAmountMap(neverDoneCtx, orderIds)
		if err != nil {
			return nil, err
		}
		for _, v := range list {
			courseStockInfo, err := s.courseAppointmentRepo.DTOShadowCourseAppointment(v)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			courseStockInfo.UpdatedByName = adminMap[v.UpdatedBy]
			courseStockInfo.CourseName = courseIdToName[v.CourseID]
			courseStockInfo.GoodName = goodMap[v.GoodID]
			// 实收金额：从分转换为元，保留两位小数；无法关联子订单时显示 --
			receiptAmount := orderIdToReceiptMap[v.OrderID]
			price := "--"
			if receiptAmount > 0 {
				priceInYuan := float64(receiptAmount) / 100.0
				price = fmt.Sprintf("%.2f", priceInYuan)
			}
			csvData = append(csvData, []string{
				courseStockInfo.Id,
				courseStockInfo.OrderId,
				orderNumberMap[courseStockInfo.OrderId],
				courseStockInfo.CourseName,
				courseStockInfo.Date,
				courseStockInfo.Period,
				courseStockInfo.StudentName,
				courseStockInfo.StudentIdentityCard,
				strconv.Itoa(int(courseStockInfo.StudentAge)),
				constant.StudentSexToName[courseStockInfo.StudentSex],
				courseStockInfo.ParentName,
				courseStockInfo.ParentPhone,
				constant.ParentAccompanyToName[courseStockInfo.ParentAccompany],
				courseStockInfo.VerificationCode,
				courseStockInfo.ParentRemark,
				courseStockInfo.BusinessRemark,
				price,
				timeutil.Carbon().Parse(courseStockInfo.CreatedAt).ToDateTimeString(),
				timeutil.Carbon().Parse(courseStockInfo.UpdatedAt).ToDateTimeString(),
				courseStockInfo.UpdatedByName,
				constant.CourseAppointmentStatusToName[courseStockInfo.Status],
			})
		}
		return csvData, nil
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.DownloadUrl = downloadUrl
	return resp, nil
}
