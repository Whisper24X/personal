package biz

import (
	"context"
	"net/http"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// QueryContractList 查询合同列表
func (s *ShadowV1ContractUseCase) QueryContractList(ctx context.Context, req *pb.QueryContractListReq) (*pb.QueryContractListReply, error) {
	resp := &pb.QueryContractListReply{}
	param := &condition.Req{}

	// 设置分页参数
	page := int32(1)
	pageSize := int32(20)
	if req.GetPage() != 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() != 0 {
		pageSize = req.GetPageSize()
	}
	param.Page = page
	param.PageSize = pageSize

	// 按孩子姓名查询
	if req.ChildName != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "childName",
			Value: req.ChildName,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 按家长电话查询
	if req.ParentPhone != "" {
		parentPh, err := cryptutil.YcPhoneEncrypt(req.ParentPhone)
		if err != nil {
			return resp, errors.New(http.StatusConflict, "-1", "解析家长手机号失败！")
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "parentPh",
			Value: parentPh,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 按合同主题查询
	if req.Topic != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "topic",
			Value: req.Topic,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 按合同状态查询
	if req.Status != 0 {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "contractStatus",
			Value: req.Status,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 按合同类型查询
	if req.ContractType != 0 {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "contractType",
			Value: req.ContractType,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 按营期开始时间查询
	if req.ActivityStartDate != "" {
		// 解析日期字符串
		activityDate, err := time.Parse("2006-01-02", req.ActivityStartDate)
		if err != nil {
			return resp, errors.New(http.StatusBadRequest, "-1", "营期开始时间格式不正确，请使用YYYY-MM-DD格式")
		}

		// 设置东八区时区
		cstZone := time.FixedZone("CST", 8*3600)

		// 获取东八区的当天开始时间
		startOfDay := time.Date(activityDate.Year(), activityDate.Month(), activityDate.Day(), 0, 0, 0, 0, cstZone)
		// 获取东八区的当天结束时间
		endOfDay := time.Date(activityDate.Year(), activityDate.Month(), activityDate.Day(), 23, 59, 59, 999999999, cstZone)

		// 使用BETWEEN查询当天的所有记录
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "activityStartDate",
			Value: startOfDay,
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "activityStartDate",
			Value: endOfDay,
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}

	// 设置排序，默认按创建时间倒序
	param.Order = append(param.Order, &condition.OrderParam{
		Field: "createdAt",
		Order: condition.DESC,
	})

	recordList, reply, err := s.contractRecordRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 设置总数
	resp.Total = reply.Total

	// 构建返回列表
	for _, record := range recordList {
		parentPh, err := cryptutil.YcPhoneDecrypt(record.ParentPh)
		if err != nil {
			return resp, errors.New(http.StatusConflict, "-1", "解析家长手机号失败！")
		}
		childPh, err := cryptutil.YcPhoneDecrypt(record.ChildPh)
		if err != nil {
			return resp, errors.New(http.StatusConflict, "-1", "解析孩子手机号失败！")
		}
		childId, err := cryptutil.YcCardDecrypt(record.ChildID)
		if err != nil {
			return resp, errors.New(http.StatusConflict, "-1", "解析孩子身份证号失败！")
		}
		item := &pb.ContractItem{
			Id:                  record.ID,
			SignFlowId:          record.SignFlowID,
			ParentName:          record.ParentName,
			ParentPhone:         parentPh,
			ChildName:           record.ChildName,
			ChildPhone:          childPh,
			ChildId:             childId,
			UserSource:          record.UserSource,
			Topic:               record.Topic,
			ContractStatus:      record.ContractStatus,
			ContractLink:        record.ContractLink,
			ContractType:        int32(record.ContractType),
			CourseAppointmentId: record.CourseAppointmentID,
			CreatedAt:           record.CreatedAt.Format(time.RFC3339),
			UpdatedAt:           record.UpdatedAt.Format(time.RFC3339),
		}

		// 处理可能为空的时间字段
		if !record.ActivityStartDate.IsZero() {
			item.ActivityStartDate = record.ActivityStartDate.Format("2006-01-02")
		}
		if !record.ActivityEndDate.IsZero() {
			item.ActivityEndDate = record.ActivityEndDate.Format("2006-01-02")
		}
		if !record.PayEndDate.IsZero() {
			item.PayEndDate = record.PayEndDate.Format("2006-01-02")
		}

		// 其他字段
		item.PurchaseChannel = record.PurchaseChannel
		item.ChildGrade = record.ChildGrade
		item.ChildGender = record.ChildGender
		item.Cost = record.Cost
		item.CostCapital = record.CostCapital

		resp.List = append(resp.List, item)
	}

	return resp, nil
}
