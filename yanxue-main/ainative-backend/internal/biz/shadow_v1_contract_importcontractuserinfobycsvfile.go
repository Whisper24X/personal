package biz

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"baliance.com/gooxml/document"
	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
)

type UploadFileReq struct {
	FilePath            string `json:"filePath"`
	ConvertToPDF        bool   `json:"convertToPDF"`
	PsnAccount          string `json:"psnAccount"`
	PsnName             string `json:"psnName"`
	ContractName        string `json:"contractName"`
	ActivityStartDate   string `json:"activityStartDate"`
	ThirdCompanyName    string `json:"thirdCompanyName"`    // 第三方公司名
	ThirdCompanyAccount string `json:"thirdCompanyAccount"` // 第三方公司经办人账号
	ThirdCompanyPsnName string `json:"thirdCompanyPsnName"` // 第三方公司经办人姓名
	ContractType        int32  `json:"contractType"`        // 合同类型：1：单日营；2：多日营
}

type AsyncUploadTaskItem struct {
	UploadFileReq  *UploadFileReq
	ContractRecord *yanxue_model.ContractRecord
}

// ImportContractUserInfoByCsvFile 导入创建合同的用户信息
func (s *ShadowV1ContractUseCase) ImportContractUserInfoByCsvFile(ctx context.Context, req *pb.ImportContractUserInfoByCsvFileReq) (*pb.ImportContractUserInfoByCsvFileReply, error) {
	reply := &pb.ImportContractUserInfoByCsvFileReply{}
	// 检查文件格式是否为CSV
	fileUrl := req.GetFileUrl()
	if !strings.HasSuffix(strings.ToLower(fileUrl), ".csv") {
		return reply, errors.New(http.StatusBadRequest, "-1", "只支持CSV格式文件！")
	}

	csvSlice, err := fileutil.ReadUrlFileLineToSli(fileUrl)
	if err != nil {
		return reply, errors.New(http.StatusInternalServerError, "-1", "文件解析失败！请稍后重试！")
	}
	if len(csvSlice) <= 1 {
		return reply, errors.New(http.StatusBadRequest, "-1", "文件不能为空！")
	}

	// 解析CSV文件标题行
	titleStr := csvSlice[0]
	reader := csv.NewReader(strings.NewReader(titleStr))
	reader.Comma = ','
	titleSlice, err := reader.Read()
	if err != nil {
		return reply, errors.New(http.StatusBadRequest, "-1", "标题解析失败！")
	}

	// 处理标题行，提取字段名
	type ItemInfo struct {
		DisplayName string // 显示名称
		FieldName   string // 字段名称
	}
	var itemInfoList []ItemInfo
	for _, item := range titleSlice {
		// 检查是否包含分隔符"|"
		if strings.Contains(item, "｜") {
			itemSlice := strings.Split(item, "｜")
			if len(itemSlice) >= 2 {
				// 有英文字段名的情况，如"家长姓名|parent_name"
				itemInfoList = append(itemInfoList, ItemInfo{
					DisplayName: strings.TrimSpace(itemSlice[0]),
					FieldName:   strings.TrimSpace(itemSlice[1]),
				})
			} else {
				// 分隔符存在但格式不正确
				return reply, errors.New(http.StatusBadRequest, "-1", "标题格式错误，包含分隔符的标题应满足显示名称|字段名的格式！")
			}
		} else {
			// 没有英文字段名的情况，如"主题"，不需要特殊处理
			itemInfoList = append(itemInfoList, ItemInfo{
				DisplayName: strings.TrimSpace(item),
				FieldName:   "", // 字段名为空，表示不需要替换到文档中
			})
		}
	}

	// 处理数据行
	var contractDataList []map[string]interface{}
	// 研学主题名称
	subjectNameMap := make(map[string]bool, 5)
	for i := 1; i < len(csvSlice); i++ {
		if csvSlice[i] == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", "文件中不能包含多余的空行！")
		}
		if strings.Contains(csvSlice[i], "\n") || strings.Contains(csvSlice[i], "\r") || strings.Contains(csvSlice[i], "\r\n") {
			return reply, errors.New(http.StatusBadRequest, "-1", "文件中不能包含换行符！")
		}

		dataStr := csvSlice[i]
		csvSliceReader := csv.NewReader(strings.NewReader(dataStr))
		csvSliceReader.Comma = ','
		dataSlice, err := csvSliceReader.Read()
		if err != nil {
			return reply, errors.New(http.StatusBadRequest, "-1", "数据解析失败！")
		}
		if len(dataSlice) != len(titleSlice) {
			return reply, errors.New(http.StatusBadRequest, "-1", "数据列数与标题列数不一致，请检查数据是否包含额外的换行符！")
		}

		// 构建每行数据的字段映射
		contractData := make(map[string]interface{})
		for j := 0; j < len(dataSlice); j++ {
			// 只处理有字段名的列
			if itemInfoList[j].FieldName != "" {
				value := strings.TrimSpace(dataSlice[j])
				// 检查是否为日期格式并转换
				if isDateValue(value) {
					value = formatDateString(value)
				}
				contractData[itemInfoList[j].FieldName] = value
			}
			// 获取研学主题名称
			if itemInfoList[j].DisplayName == constant.SubjectDisplayName {
				if dataSlice[j] != "" {
					subjectNameMap[dataSlice[j]] = true
				}
			}
		}
		contractDataList = append(contractDataList, contractData)
	}

	// 查询主题对应的模版url
	var templateNames []string
	for templateName := range subjectNameMap {
		templateNames = append(templateNames, templateName)
	}
	templateExistMap := make(map[string]bool, len(templateNames))
	templates, err := s.contractTemplateRepo.FindMultiByTemplateNames(ctx, templateNames)
	if err != nil {
		return reply, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, template := range templates {
		if template.Status == constant.TemplateInvalidStatus {
			return reply, errors.New(http.StatusConflict, "-1", fmt.Sprintf("请检查主题：%s 对应的模版是否已启用！", template.TemplateName))
		}
		templateExistMap[template.TemplateName] = true
	}
	// 数量对不上
	if len(templates) != len(templateNames) {
		return reply, errors.New(http.StatusConflict, "-1", "请检查所有的主题是否都有对应的模版！")
	}
	// 下载模板文件到本地
	for _, template := range templates {
		// 检查本地文件是否已存在，如果存在则跳过下载
		tempFileName := fmt.Sprintf("%s.docx", template.TemplateName)
		if _, err := os.Stat(tempFileName); err == nil {
			// 文件已存在，记录日志并跳过下载
			s.log.Infof("模板文件 %s 已存在，跳过下载", tempFileName)
			continue
		}
		// 文件不存在，继续下载流程
		// 创建HTTP请求
		resp, err := http.Get(template.TemplateURL)
		if err != nil {
			return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("下载模板文件失败：%v", err))
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode != http.StatusOK {
			return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("下载模板文件失败，HTTP状态码：%d", resp.StatusCode))
		}

		tempFile, err := os.Create(tempFileName)
		if err != nil {
			return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("创建临时文件失败：%v", err))
		}

		// 将响应内容写入临时文件
		_, err = io.Copy(tempFile, resp.Body)
		tempFile.Close()
		if err != nil {
			return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("保存模板文件失败：%v", err))
		}
	}

	// 删除之前下载的模版文件
	defer func(templateNames []string) {
		for _, templateName := range templateNames {
			tempFileName := fmt.Sprintf("%s.docx", templateName)
			os.Remove(tempFileName)
		}
	}(templateNames)
	// 异步任务列表
	var asyncUploadTaskList []*AsyncUploadTaskItem

	asyncTaskInfo := &yanxue_model.AsyncTask{
		TaskType: constant.ContractInfoImportTaskType,
		Status:   constant.AsyncTaskStatusPending,
	}
	err = s.asyncTaskRepo.CreateOne(ctx, asyncTaskInfo)
	if err != nil {
		return reply, errorx.DataSQLErr.WithError(err).Err()
	}
	// 赋值
	reply.AsyncTaskId = asyncTaskInfo.ID

	// 为每行数据生成一个合同文件
	for _, contractData := range contractDataList {
		// 创建模板文件的副本
		// 孩子姓名
		childName, ok := contractData["child_name"].(string)
		if !ok || childName == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", "孩子姓名不能为空")
		}

		// 家长姓名
		parentName, ok := contractData["parent_name"].(string)
		if !ok || parentName == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的家长姓名不能为空", childName))
		}

		// 家长电话
		parentPhone, ok := contractData["parent_phone"].(string)
		if !ok || parentPhone == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的家长电话不能为空", childName))
		}

		// 孩子身份证号
		childId, ok := contractData["child_id"].(string)
		if !ok || childId == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的身份证号不能为空", childName))
		}

		// 主题
		topic, ok := contractData["topic"].(string)
		if !ok || topic == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的主题不能为空", childName))
		}

		// 营期开始时间
		activityStartDate, ok := contractData["activity_start_date"].(string)
		if !ok || activityStartDate == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的营期开始时间不能为空", childName))
		}

		// 营期结束时间
		activityEndDate, ok := contractData["activity_end_date"].(string)
		if !ok || activityEndDate == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的营期结束时间不能为空", childName))
		}

		// 参营费用
		cost, ok := contractData["cost"].(string)
		if !ok || cost == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的参营费用不能为空", childName))
		}

		// 参营费用大写
		costCapital, ok := contractData["cost_capital"].(string)
		if !ok || costCapital == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的参营费用大写不能为空", childName))
		}

		// 费用支付截止时间
		payEndDate, ok := contractData["pay_end_date"].(string)
		if !ok || payEndDate == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的费用支付截止时间不能为空", childName))
		}

		// 检验主题是否有效，是否有对应的模版
		if !templateExistMap[topic] {
			return reply, errors.New(http.StatusConflict, "-1", fmt.Sprintf("请检查主题：%s 对应的模版是否已启用！", topic))
		}

		// 校验身份证号是否有效
		if !isValidIDCard(childId) {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的身份证号码格式不正确", childName))
		}

		// 校验家长手机号是否有效
		if !IsValidPhoneNumber(parentPhone) {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的家长手机号格式不正确", childName))
		}

		// 将日期字符串转换为time.Time类型
		var activityStartTime, activityEndTime, payEndTime time.Time
		var parseErr error

		// 解析营期开始时间
		activityStartTime, parseErr = time.Parse("2006年1月2日", activityStartDate)
		if parseErr != nil {
			s.log.Errorf("解析营期开始时间失败: %v, 原始值: %s", parseErr, activityStartDate)
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请确认%s同学的营期开始时间是否符合2025/4/25这样的格式!", childName))
		}

		// 解析营期结束时间
		activityEndTime, parseErr = time.Parse("2006年1月2日", activityEndDate)
		if parseErr != nil {
			s.log.Errorf("解析营期结束时间失败: %v, 原始值: %s", parseErr, activityEndDate)
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请确认%s同学的营期结束时间是否符合2025/4/25这样的格式!", childName))
		}

		// 解析费用支付截止时间
		payEndTime, parseErr = time.Parse("2006年1月2日", payEndDate)
		if parseErr != nil {
			s.log.Errorf("解析费用支付截止时间失败: %v, 原始值: %s", parseErr, payEndDate)
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请确认%s同学的费用支付截止时间是否符合2025/4/25这样的格式!", childName))
		}

		// 合同类型
		contractTypeStr, ok := contractData["contract_type"].(string)
		if !ok || contractTypeStr == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的合同类型不能为空", childName))
		}
		if contractTypeStr != constant.ContractTypeSingleDayStr && contractTypeStr != constant.ContractTypeMultiDayStr {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的合同类型不合法", childName))
		}
		var contractType int32
		// 单日营
		if contractTypeStr == constant.ContractTypeSingleDayStr {
			contractType = constant.ContractTypeSingleDay
		} else { // 多日营
			contractType = constant.ContractTypeMultiDay
		}

		// 如果是多日营，则必须有第三方公司的名称和联系人
		var thirdCompanyName, thirdCompanyAccount, thirdCompanyPsnName string
		if contractType == constant.ContractTypeMultiDay {
			thirdCompanyName, ok = contractData["third_company_name"].(string)
			if !ok || thirdCompanyName == "" {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的第三方公司名称不能为空", childName))
			}
			thirdCompanyAccount, ok = contractData["third_company_account"].(string)
			if !ok || thirdCompanyAccount == "" {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的第三方公司联系方式不能为空", childName))
			}
			thirdCompanyPsnName, ok = contractData["third_company_psn_name"].(string)
			if !ok || thirdCompanyPsnName == "" {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s同学的第三方公司联系人姓名不能为空", childName))
			}
		}

		newFileName := fmt.Sprintf("%s-%s.docx", childName, topic)

		templatePath := fmt.Sprintf("%s.docx", topic)
		// 复制模板文件
		err = fileutil.CopyFile(templatePath, newFileName)
		if err != nil {
			return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("创建合同文件失败：%v", err))
		}
		newFilePath := newFileName

		// 替换文件中的占位符
		err = replaceDocxPlaceholders(newFilePath, contractData)
		if err != nil {
			return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("替换合同内容失败：%v", err))
		}

		contractName := fmt.Sprintf("%s-%s-%s", childName, topic, activityStartDate)

		uploadFileReq := &UploadFileReq{
			FilePath:            newFilePath,
			ConvertToPDF:        true,
			PsnAccount:          parentPhone,
			PsnName:             parentName,
			ContractName:        contractName,
			ActivityStartDate:   activityStartDate,
			ContractType:        contractType,
			ThirdCompanyName:    thirdCompanyName,
			ThirdCompanyAccount: thirdCompanyAccount,
			ThirdCompanyPsnName: thirdCompanyPsnName,
		}

		contractRecord := &yanxue_model.ContractRecord{
			SignFlowID:        "",
			ParentName:        parentName,
			ParentPh:          parentPhone,
			ChildName:         childName,
			ChildID:           childId,
			Topic:             topic,
			ActivityStartDate: activityStartTime,
			ActivityEndDate:   activityEndTime,
			Cost:              cost,
			CostCapital:       costCapital,
			PayEndDate:        payEndTime,
			ContractStatus:    1,
			ContractLink:      "",
			ContractType:      int16(contractType),
		}
		asyncUploadTaskList = append(asyncUploadTaskList, &AsyncUploadTaskItem{
			UploadFileReq:  uploadFileReq,
			ContractRecord: contractRecord,
		})
	}
	// 异步执行
	go s.AsyncUploadFile(context.Background(), asyncTaskInfo.ID, asyncUploadTaskList)

	return reply, nil
}

func (s *ShadowV1ContractUseCase) AsyncUploadFile(ctx context.Context, asyncTaskId string, asyncUploadTaskList []*AsyncUploadTaskItem) error {
	// 先上传文件，让E签宝有更多时间转换文件格式，然后再签合同
	fileIdToAsyncUploadTaskItemMap := make(map[string]*AsyncUploadTaskItem)
	// 过滤掉已存在的合同记录
	filteredTaskList := make([]*AsyncUploadTaskItem, 0)
	for _, task := range asyncUploadTaskList {
		// 加密后再查询
		childId, err := cryptutil.YcCardEncrypt(task.ContractRecord.ChildID)
		if err != nil {
			return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请检查身份证号:%s是否有效！", childId))
		}
		// 查询是否存在相同的合同记录
		_, reply, err := s.contractRecordRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "childID",
					Value: childId,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "topic",
					Value: task.ContractRecord.Topic,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "activityStartDate",
					Value: task.ContractRecord.ActivityStartDate,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "contractStatus",
					Value: constant.ContractStatusRevoke,
					Exp:   condition.NEQ,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			s.log.Errorf("查询合同记录是否存在失败: %v", err)
			s.asyncTaskRepo.UpdateOne(ctx, &yanxue_model.AsyncTask{
				ID:        asyncTaskId,
				TaskType:  constant.ContractInfoImportTaskType,
				Status:    constant.AsyncTaskStatusFailed,
				ErrorInfo: "查询合同记录是否存在失败: " + err.Error(),
			})
			return errorx.DataSQLErr.WithError(err).Err()
		}

		// 如果不存在相同的数据，则加入任务中
		if reply.Total == 0 {
			filteredTaskList = append(filteredTaskList, task)
		} else {
			s.log.Infof("过滤掉重复的合同记录: 孩子ID=%s, 主题=%s, 开始日期=%s",
				task.ContractRecord.ChildID,
				task.ContractRecord.Topic,
				task.ContractRecord.ActivityStartDate.Format("2006-01-02"))
			continue
		}
	}

	// 如果过滤后没有任务，则直接更新任务状态为成功并返回
	if len(filteredTaskList) == 0 {
		s.asyncTaskRepo.UpdateOne(ctx, &yanxue_model.AsyncTask{
			ID:        asyncTaskId,
			TaskType:  constant.ContractInfoImportTaskType,
			Status:    constant.AsyncTaskStatusSuccess,
			ErrorInfo: "所有合同记录已存在，无需重复导入",
		})
		return nil
	}
	for _, task := range filteredTaskList {
		fileId, err := s.eSignRepo.UploadFile(ctx, task.UploadFileReq)
		if err != nil {
			s.asyncTaskRepo.UpdateOne(ctx, &yanxue_model.AsyncTask{
				ID:        asyncTaskId,
				TaskType:  constant.ContractInfoImportTaskType,
				Status:    constant.AsyncTaskStatusFailed,
				ErrorInfo: err.Error(),
			})
			return errorx.APIThirdErr.WithError(err).Err()
		}
		// 上传成功后，删除本地文件
		fileutil.Remove(task.UploadFileReq.FilePath)
		if fileId != "" {
			fileIdToAsyncUploadTaskItemMap[fileId] = task
		}
	}
	for fileId, task := range fileIdToAsyncUploadTaskItemMap {
		signFlowId, contractLink, err := s.eSignRepo.SignContract(ctx, task.UploadFileReq, fileId)
		if err != nil {
			s.asyncTaskRepo.UpdateOne(ctx, &yanxue_model.AsyncTask{
				ID:        asyncTaskId,
				TaskType:  constant.ContractInfoImportTaskType,
				Status:    constant.AsyncTaskStatusFailed,
				ErrorInfo: err.Error(),
			})
			return errorx.APIThirdErr.WithError(err).Err()
		}
		task.ContractRecord.SignFlowID = signFlowId
		task.ContractRecord.ContractLink = contractLink
		// 敏感信息入库前需要加密
		parentPh, err := cryptutil.YcPhoneEncrypt(task.ContractRecord.ParentPh)
		if err != nil {
			return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请检查家长手机号:%s是否有效！", parentPh))
		}

		childPh, err := cryptutil.YcPhoneEncrypt(task.ContractRecord.ChildPh)
		if err != nil {
			return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请检查孩子手机号:%s是否有效！", childPh))
		}

		childId, err := cryptutil.YcCardEncrypt(task.ContractRecord.ChildID)
		if err != nil {
			return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请检查身份证号:%s是否有效！", childId))
		}
		task.ContractRecord.ParentPh = parentPh
		task.ContractRecord.ChildPh = childPh
		task.ContractRecord.ChildID = childId
		err = s.contractRecordRepo.CreateOne(ctx, task.ContractRecord)
		if err != nil {
			s.asyncTaskRepo.UpdateOne(ctx, &yanxue_model.AsyncTask{
				ID:        asyncTaskId,
				TaskType:  constant.ContractInfoImportTaskType,
				Status:    constant.AsyncTaskStatusFailed,
				ErrorInfo: err.Error(),
			})
			return errorx.DataSQLErr.WithError(err).Err()
		}
	}
	s.asyncTaskRepo.UpdateOne(ctx, &yanxue_model.AsyncTask{
		ID:        asyncTaskId,
		TaskType:  constant.ContractInfoImportTaskType,
		Status:    constant.AsyncTaskStatusSuccess,
		ErrorInfo: "",
	})
	return nil
}

// isDateValue 判断字符串是否为日期格式
func isDateValue(value string) bool {
	// 常见的日期格式正则表达式
	datePatterns := []string{
		`^\d{4}-\d{1,2}-\d{1,2}$`,                 // 2023-01-01
		`^\d{4}/\d{1,2}/\d{1,2}$`,                 // 2023/01/01, 2025/4/26
		`^\d{1,2}-\d{1,2}-\d{4}$`,                 // 01-01-2023
		`^\d{1,2}/\d{1,2}/\d{4}$`,                 // 01/01/2023
		`^\d{4}\.\d{1,2}\.\d{1,2}$`,               // 2023.01.01
		`^\d{4}年\d{1,2}月\d{1,2}日$`,                // 2023年01月01日
		`^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}$`, // 2023-01-01 12:00
		`^\d{4}/\d{1,2}/\d{1,2} \d{1,2}:\d{1,2}$`, // 2023/01/01 12:00
	}

	for _, pattern := range datePatterns {
		matched, _ := regexp.MatchString(pattern, value)
		if matched {
			return true
		}
	}
	return false
}

// formatDateString 将日期字符串转换为"XX年XX月XX日"格式
func formatDateString(dateStr string) string {
	// 尝试解析各种可能的日期格式
	var t time.Time
	var err error

	// 处理特殊格式如 2025/4/26
	if matched, _ := regexp.MatchString(`^\d{4}/\d{1,2}/\d{1,2}$`, dateStr); matched {
		parts := strings.Split(dateStr, "/")
		if len(parts) == 3 {
			year := parts[0]
			month := parts[1]
			day := parts[2]
			// 补全月和日的前导零
			if len(month) == 1 {
				month = "0" + month
			}
			if len(day) == 1 {
				day = "0" + day
			}
			dateStr = year + "/" + month + "/" + day
		}
	}

	formats := []string{
		"2006-01-02",
		"2006/01/02",
		"01-02-2006",
		"01/02/2006",
		"2006.01.02",
		"2006年01月02日",
		"2006-01-02 15:04",
		"2006/01/02 15:04",
	}

	for _, format := range formats {
		t, err = time.Parse(format, dateStr)
		if err == nil {
			break
		}
	}

	if err != nil {
		// 如果无法解析，返回原始字符串
		return dateStr
	}

	// 转换为"XX年XX月XX日"格式
	return fmt.Sprintf("%d年%d月%d日", t.Year(), int(t.Month()), t.Day())
}

func extractFromParagraph(para document.Paragraph, ph map[string]bool) {
	// 预编译正则表达式（全局变量）（允许字母、数字、下划线，兼容空格）
	var placeholderRegex = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`)
	// 合并段落内所有 Run 的文本
	var fullText strings.Builder
	for _, run := range para.Runs() {
		fullText.WriteString(run.Text())
	}
	// 在全文本中匹配占位符
	matches := placeholderRegex.FindAllStringSubmatch(fullText.String(), -1)
	for _, match := range matches {
		if len(match) > 1 {
			ph[match[1]] = true
		}
	}
}

// replaceDocxPlaceholders 替换DOCX文件中的占位符
func replaceDocxPlaceholders(filePath string, data map[string]interface{}) error {
	// 使用baliance/gooxml库处理docx文件
	doc, err := document.Open(filePath)
	if err != nil {
		return fmt.Errorf("打开文档失败: %v", err)
	}

	// 记录是否有替换操作
	replaced := false

	// 获取文档中的所有段落
	// 记录未替换成功的占位符
	unReplacedPlaceholders := make(map[string]bool)

	// 先扫描所有文本，收集所有占位符
	allPlaceholders := make(map[string]bool)
	for _, para := range doc.Paragraphs() {
		extractFromParagraph(para, allPlaceholders)
	}

	// 检查数据中是否包含所有占位符
	for placeholder := range allPlaceholders {
		if val, exists := data[placeholder]; !exists {
			unReplacedPlaceholders[placeholder] = true
			fmt.Println("val: ", val)
		}
	}

	// 如果存在数据中没有的的占位符，返回错误
	if len(unReplacedPlaceholders) > 0 {
		placeholders := make([]string, 0, len(unReplacedPlaceholders))
		for p := range unReplacedPlaceholders {
			placeholders = append(placeholders, fmt.Sprintf("{{%s}}", p))
		}
		return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("文档中存在未替换的占位符: %s，请检查CSV文件中是否包含这些字段", strings.Join(placeholders, ", ")))
	}

	// 执行替换
	// 遍历段落
	var placeholderRegex = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`)
	// 遍历所有段落
	for _, para := range doc.Paragraphs() {
		// 合并段落内所有Run的文本（解决跨Run占位符问题）
		fullText := strings.Builder{}
		for _, run := range para.Runs() {
			fullText.WriteString(run.Text())
		}
		originalText := fullText.String()
		modifiedText := originalText

		// 正则匹配替换
		matches := placeholderRegex.FindAllStringSubmatch(originalText, -1)
		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			key := match[1]
			if value, exists := data[key]; exists {
				modifiedText = strings.ReplaceAll(modifiedText,
					"{{"+key+"}}",
					fmt.Sprintf("%v", value))
			}
		}

		// 更新段落内容（适配v1.39.0版本API）
		if modifiedText != originalText {
			replaced = true
			// 清空所有Run内容
			for _, run := range para.Runs() {
				run.ClearContent()
			}
			// 将新文本写入首个Run（保留格式）
			if len(para.Runs()) > 0 {
				para.Runs()[0].AddText(modifiedText)
			} else {
				para.AddRun().AddText(modifiedText)
			}
		}
	}

	// 再次检查是否还有未替换的占位符
	unReplacedPlaceholders = make(map[string]bool) // 重置未替换占位符列表，确保准确性
	for _, para := range doc.Paragraphs() {
		extractFromParagraph(para, unReplacedPlaceholders)
	}

	// 如果存在未替换的占位符，返回错误
	if len(unReplacedPlaceholders) > 0 {
		placeholders := make([]string, 0, len(unReplacedPlaceholders))
		for p := range unReplacedPlaceholders {
			placeholders = append(placeholders, fmt.Sprintf("{{%s}}", p))
		}
		return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("文档中存在未替换的占位符: %s，请检查CSV文件中是否包含这些字段", strings.Join(placeholders, ", ")))
	}

	// 如果没有替换任何内容，可能是占位符格式不匹配
	if !replaced {
		fmt.Printf("警告：未找到任何匹配的占位符，请检查文档中的占位符格式是否为{{字段名}}，以及CSV文件中的字段名是否正确\n")
		fmt.Printf("当前数据字段：%v\n", data)
		return errors.New(http.StatusBadRequest, "-1", "未找到任何匹配的占位符，请检查文档中的占位符格式是否为{{字段名}}，以及CSV文件中的字段名是否正确!")
	}

	// 保存修改后的文档
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %v", err)
	}
	defer f.Close()

	err = doc.Save(f)
	if err != nil {
		return fmt.Errorf("保存文档失败: %v", err)
	}

	return nil
}

func (s *ShadowV1ContractUseCase) SyncContractStatus(ctx context.Context) error {
	// 查询签署中状态的数据
	param := &condition.Req{}
	param.Query = append(param.Query, &condition.QueryParam{
		Field: "contractStatus",
		Value: constant.ContractStatusSigning,
		Exp:   condition.EQ,
		Logic: condition.AND,
	})

	contractList, _, err := s.contractRecordRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	// 调用E签宝接口查询合同状态
	for _, item := range contractList {
		status, err := s.eSignRepo.GetSignFlowDetail(ctx, item.SignFlowID)
		if err != nil {
			return errorx.ContractSendMsgFailed.WithError(err).WithFmtMsg(err.Error()).Err()
		}
		// 如果状态是草稿或者签署中，则跳过
		if status == constant.ContractStatusSigning || status == constant.ContractStatusDraft {
			s.log.Infof("合同%s 状态为%d, 不需要更新！", item.SignFlowID, status)
			continue
		}
		// 更新数据库中的状态
		newContractItem := item
		newContractItem.ContractStatus = status
		err = s.contractRecordRepo.UpdateOne(ctx, newContractItem)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
	}
	return nil
}

// isValidIDCard 验证身份证号是否有效
func isValidIDCard(idCard string) bool {
	pattern := `^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$`
	matched, _ := regexp.MatchString(pattern, idCard)
	return matched
}

// IsValidPhoneNumber 验证手机号是否有效
func IsValidPhoneNumber(phone string) bool {
	pattern := `^1[3-9]\d{9}$`
	matched, _ := regexp.MatchString(pattern, phone)
	return matched
}
