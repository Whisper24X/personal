package biz

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
)

// GenerateContractByUserInfo 生成合同
func (s *ShadowV1ContractUseCase) GenerateContractByUserInfo(ctx context.Context, req *pb.GenerateContractByUserInfoReq) (*pb.GenerateContractByUserInfoReply, error) {
	resp := &pb.GenerateContractByUserInfoReply{}
	// 查询预约记录
	courseAppointment, err := s.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetCourseAppointmentId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	courseId := courseAppointment.CourseID
	courseInfo, err := s.courseRepo.FindOneCacheByID(ctx, courseId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	topic := courseInfo.CourseName
	// 下载研学主题模版
	template, err := s.contractTemplateRepo.FindOneByTemplateName(ctx, courseInfo.CourseName)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if template == nil {
		return resp, errors.New(http.StatusConflict, "-1", fmt.Sprintf("未找到主题：%s 对应的模版！", topic))
	}
	if template.Status == constant.TemplateInvalidStatus {
		return resp, errors.New(http.StatusConflict, "-1", fmt.Sprintf("请检查主题：%s 对应的模版是否已启用！", template.TemplateName))
	}

	// 下载模版文件
	tempFileName := fmt.Sprintf("%s.docx", template.TemplateName)
	// 创建HTTP请求
	reply, err := http.Get(template.TemplateURL)
	if err != nil {
		return resp, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("下载模板文件失败：%v", err))
	}
	defer reply.Body.Close()

	// 检查响应状态
	if reply.StatusCode != http.StatusOK {
		return resp, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("下载模板文件失败，HTTP状态码：%d", reply.StatusCode))
	}

	tempFile, err := os.Create(tempFileName)
	if err != nil {
		return resp, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("创建临时文件失败：%v", err))
	}

	// 将响应内容写入临时文件
	_, err = io.Copy(tempFile, reply.Body)
	tempFile.Close()
	if err != nil {
		return resp, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("保存模板文件失败：%v", err))
	}

	// 删除之前下载的模版文件
	defer func(tempFileName string) {
		os.Remove(tempFileName)
	}(tempFileName)

	newFileName := fmt.Sprintf("%s-%s.docx", req.GetChildName(), topic)

	templatePath := fmt.Sprintf("%s.docx", topic)
	// 复制模板文件
	err = fileutil.CopyFile(templatePath, newFileName)
	if err != nil {
		return resp, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("创建合同文件失败：%v", err))
	}
	newFilePath := newFileName

	// 校验数据合法性
	// 校验身份证号是否有效
	if req.ChildId == "" {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的身份证号码不能为空", req.ChildName))
	}
	if !isValidIDCard(req.ChildId) {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的身份证号码格式不正确", req.ChildName))
	}

	// 校验家长手机号是否有效
	if !IsValidPhoneNumber(req.ParentPhone) {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的家长手机号格式不正确", req.ChildName))
	}

	// 替换文件中的占位符
	contractData := map[string]interface{}{
		"child_name":          req.GetChildName(),
		"parent_name":         req.GetParentName(),
		"parent_phone":        req.GetParentPhone(),
		"child_id":            req.GetChildId(),
		"topic":               topic,
		"activity_start_date": req.GetActivityStartDate(),
		"activity_end_date":   req.GetActivityEndDate(),
		"cost":                req.GetCost(),
		"cost_capital":        req.GetCostCapital(),
		"pay_end_date":        req.GetPayEndDate(),
	}
	err = replaceDocxPlaceholders(newFilePath, contractData)
	if err != nil {
		return resp, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("替换合同内容失败：%v", err))
	}

	// 将日期字符串转换为time.Time类型
	var activityStartTime, activityEndTime, payEndTime time.Time
	var parseErr error

	// 解析营期开始时间
	activityStartTime, parseErr = time.Parse("2006年1月2日", req.GetActivityStartDate())
	if parseErr != nil {
		s.log.Errorf("解析营期开始时间失败: %v, 原始值: %s", parseErr, req.GetActivityStartDate())
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请确认%s同学的营期开始时间是否符合2025/4/25这样的格式!", req.GetChildName()))
	}

	// 解析营期结束时间
	activityEndTime, parseErr = time.Parse("2006年1月2日", req.GetActivityEndDate())
	if parseErr != nil {
		s.log.Errorf("解析营期结束时间失败: %v, 原始值: %s", parseErr, req.GetActivityEndDate())
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请确认%s同学的营期结束时间是否符合2025/4/25这样的格式!", req.GetChildName()))
	}

	// 解析费用支付截止时间
	payEndTime, parseErr = time.Parse("2006年1月2日", req.GetPayEndDate())
	if parseErr != nil {
		s.log.Errorf("解析费用支付截止时间失败: %v, 原始值: %s", parseErr, req.GetPayEndDate())
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请确认%s同学的费用支付截止时间是否符合2025/4/25这样的格式!", req.GetChildName()))
	}

	contractName := fmt.Sprintf("%s-%s-%s", req.ChildName, topic, req.ActivityStartDate)

	uploadFileReq := &UploadFileReq{
		FilePath:          newFilePath,
		ConvertToPDF:      true,
		PsnAccount:        req.ParentPhone,
		PsnName:           req.ParentName,
		ContractName:      contractName,
		ActivityStartDate: req.ActivityStartDate,
		ContractType:      constant.ContractTypeSingleDay,
	}

	contractRecord := &yanxue_model.ContractRecord{
		SignFlowID:          "",
		ParentName:          req.ParentName,
		ParentPh:            req.ParentPhone,
		ChildName:           req.ChildName,
		ChildID:             req.ChildId,
		Topic:               topic,
		ActivityStartDate:   activityStartTime,
		ActivityEndDate:     activityEndTime,
		Cost:                req.Cost,
		CostCapital:         req.CostCapital,
		PayEndDate:          payEndTime,
		ContractStatus:      1,
		ContractLink:        "",
		ContractType:        int16(constant.ContractTypeSingleDay),
		CourseAppointmentID: req.CourseAppointmentId,
	}

	// 异步任务列表
	var asyncUploadTaskList []*AsyncUploadTaskItem
	asyncUploadTaskList = append(asyncUploadTaskList, &AsyncUploadTaskItem{
		UploadFileReq:  uploadFileReq,
		ContractRecord: contractRecord,
	})

	asyncTaskInfo := &yanxue_model.AsyncTask{
		TaskType: constant.ContractInfoImportTaskType,
		Status:   constant.AsyncTaskStatusPending,
	}
	err = s.asyncTaskRepo.CreateOne(ctx, asyncTaskInfo)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 赋值
	resp.AsyncTaskId = asyncTaskInfo.ID

	// 发起合同签署
	go func(taskId string, asyncUploadTaskList []*AsyncUploadTaskItem, courseAppointment *yanxue_model.CourseAppointment) {
		err = s.AsyncUploadFile(context.Background(), asyncTaskInfo.ID, asyncUploadTaskList)
		if err != nil {
			return
		}
		// 修改预约记录中的合同状态
		oldCourseAppointment := s.courseAppointmentRepo.DeepCopy(courseAppointment)

		courseAppointment.ContractStatus = constant.ContractStatusPushed
		err = s.courseAppointmentRepo.UpdateOneCache(context.Background(), courseAppointment, oldCourseAppointment)
		if err != nil {
			return
		}

	}(asyncTaskInfo.ID, asyncUploadTaskList, courseAppointment)

	return resp, nil
}
