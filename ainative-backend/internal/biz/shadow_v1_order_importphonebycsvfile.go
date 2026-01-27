package biz

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/google/uuid"
	"github.com/tealeg/xlsx/v3"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
)

// ConvertXlsxToCsv 将xlsx文件转换为csv文件的工具函数
func ConvertXlsxToCsv(xlsxBytes []byte) ([]byte, error) {
	// 创建唯一的临时文件名，防止并发冲突
	uniqueID := uuid.New().String()
	timestamp := time.Now().UnixNano()
	tempFileName := fmt.Sprintf("xlsx_import_%s_%d.xlsx", uniqueID, timestamp)
	tempFilePath := filepath.Join(os.TempDir(), tempFileName)

	// 创建临时文件
	tempFile, err := os.Create(tempFilePath)
	if err != nil {
		return nil, fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer os.Remove(tempFile.Name()) // 清理临时文件

	// 将xlsx数据写入临时文件
	if _, err := tempFile.Write(xlsxBytes); err != nil {
		return nil, fmt.Errorf("写入临时文件失败: %w", err)
	}

	// 确保数据落盘
	if err := tempFile.Sync(); err != nil {
		return nil, fmt.Errorf("同步文件数据失败: %w", err)
	}

	// 关闭文件句柄，确保数据完全写入
	if err := tempFile.Close(); err != nil {
		return nil, fmt.Errorf("关闭临时文件失败: %w", err)
	}

	// 使用tealeg/xlsx读取Excel文件
	wb, err := xlsx.OpenFile(tempFile.Name())
	if err != nil {
		return nil, fmt.Errorf("无法解析xlsx文件: %w", err)
	}

	// 获取第一个sheet
	if len(wb.Sheets) == 0 {
		return nil, fmt.Errorf("xlsx文件没有有效的sheet")
	}

	sheet := wb.Sheets[0]
	var buf bytes.Buffer
	csvWriter := csv.NewWriter(&buf)

	// 读取所有行
	err = sheet.ForEachRow(func(row *xlsx.Row) error {
		var rowData []string
		hasContent := false

		// 遍历行中的所有单元格
		row.ForEachCell(func(cell *xlsx.Cell) error {
			cellValue := cell.String()
			rowData = append(rowData, cellValue)
			// 检查是否有非空内容
			if strings.TrimSpace(cellValue) != "" {
				hasContent = true
			}
			return nil
		})

		// 只写入有内容的行（至少有一个非空单元格）
		if hasContent {
			if err := csvWriter.Write(rowData); err != nil {
				return fmt.Errorf("写入csv内容失败: %w", err)
			}
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("读取Excel行数据失败: %w", err)
	}

	csvWriter.Flush()
	if err := csvWriter.Error(); err != nil {
		return nil, fmt.Errorf("csv写入出错: %w", err)
	}

	// 获取CSV字节流
	csvBytes := buf.Bytes()

	// 检查CSV是否为空
	if len(csvBytes) == 0 {
		return nil, fmt.Errorf("xlsx文件转换后为空")
	}

	// 检测和处理编码问题（主要针对Windows Excel可能产生的GBK编码）
	if utf8.Valid(csvBytes) {
		// 文件已经是UTF-8编码，无需转换
		return csvBytes, nil
	}

	// 尝试将GBK/GB2312编码转换为UTF-8
	reader := transform.NewReader(bytes.NewReader(csvBytes), simplifiedchinese.GBK.NewDecoder())
	utf8Content, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("文件编码转换失败（可能不是GBK编码）: %w", err)
	}

	// 检查转换后的内容是否有效
	if len(utf8Content) == 0 {
		return nil, fmt.Errorf("编码转换后内容为空")
	}

	return utf8Content, nil
}

// ImportPhoneByCsvFile 订单-导入手机号
func (s *ShadowV1OrderUseCase) ImportPhoneByCsvFile(ctx context.Context, req *pb.ImportPhoneByCsvFileReq) (*pb.ImportPhoneByCsvFileReply, error) {
	reply := &pb.ImportPhoneByCsvFileReply{}
	// 操作人
	adminId := meta.GetAdminID(ctx)
	// 检查文件格式是否为xlsx
	fileUrl := req.GetFileUrl()
	if !strings.HasSuffix(strings.ToLower(fileUrl), ".xlsx") {
		return reply, errors.New(http.StatusBadRequest, "-1", "只支持xlsx格式文件！")
	}

	// 读取文件内容
	fileBytes, err := fileutil.ReadFileByURLToByte(fileUrl)
	if err != nil {
		return reply, errors.New(http.StatusInternalServerError, "-1", "文件读取失败！请稍后重试！")
	}

	// 将xlsx文件转换为csv格式
	csvContent, err := ConvertXlsxToCsv(fileBytes)
	if err != nil {
		return reply, errors.New(http.StatusInternalServerError, "-1", fmt.Sprintf("xlsx文件转换失败：%s", err.Error()))
	}

	// 按行分割内容
	csvSlice := strings.Split(string(csvContent), "\n")
	if len(csvSlice) <= 1 {
		return reply, errors.New(http.StatusBadRequest, "-1", "文件不能为空！")
	}

	// 解析CSV文件标题行
	titleStr := csvSlice[0]
	csvReader := csv.NewReader(strings.NewReader(titleStr))
	csvReader.Comma = ','
	titleSlice, err := csvReader.Read()
	if err != nil {
		return reply, errors.New(http.StatusBadRequest, "-1", "标题解析失败！")
	}

	var fieldNameList []string
	for _, item := range titleSlice {
		fieldNameList = append(fieldNameList, strings.TrimSpace(item))
	}

	// 处理数据行
	var phoneDataList []map[string]interface{}
	for i := 1; i < len(csvSlice); i++ {
		if csvSlice[i] == "" {
			continue
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
		phoneData := make(map[string]interface{})
		for j := 0; j < len(dataSlice); j++ {
			value := TrimWhitespace(dataSlice[j])
			if value == "" {
				continue
			}
			fieldName := TrimWhitespace(fieldNameList[j])
			// 校验是否包含科学计数法
			if (fieldName == "电话" || fieldName == "订单编号") && isScientificNotation(value) {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s字段不能包含科学计数法！", fieldNameList[j]))
			}
			phoneData[fieldName] = value
		}
		if len(phoneData) > 0 {
			phoneDataList = append(phoneDataList, phoneData)
		}
	}
	var channelOrderNumberList []string
	orderNumberToPhoneMap := make(map[string]string)
	for _, phoneDataMap := range phoneDataList {
		orderNumber, ok := phoneDataMap["订单编号"].(string)
		if !ok {
			continue
		}
		phone, ok := phoneDataMap["电话"].(string)
		if !ok {
			continue
		}
		channelOrderNumberList = append(channelOrderNumberList, orderNumber)
		orderNumberToPhoneMap[orderNumber] = phone
	}
	orderList, err := s.orderRepo.FindMultiByOriginOrderNumbers(ctx, channelOrderNumberList)
	if err != nil {
		return reply, errorx.DataSQLErr.WithError(err).Err()
	}
	var needUpdateOrderList []*yanxue_model.Order
	orderIdToPhMap := make(map[string]string) // 订单ID到加密手机号的映射
	for _, order := range orderList {
		if order.Ph == "" {
			phone := orderNumberToPhoneMap[order.OriginOrderNumber]
			if phone == "" {
				continue
			}
			if !IsValidPhoneNumber(phone) {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("订单编号%s对应的手机号%s格式错误！", order.OriginOrderNumber, phone))
			}
			ph, err := cryptutil.YcPhoneEncrypt(phone)
			if err != nil {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("订单编号%s对应的手机号%s格式错误！", order.OriginOrderNumber, phone))
			}
			order.Ph = ph
			needUpdateOrderList = append(needUpdateOrderList, order)
			orderIdToPhMap[order.ID] = ph
		}
	}

	// 更新订单手机号
	for _, order := range needUpdateOrderList {
		oldOrder := s.orderRepo.DeepCopy(order)
		oldOrder.Ph = ""
		order.UpdatedBy = adminId
		err := s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
		if err != nil {
			s.log.Errorf("导入手机号：更新订单手机号失败，orderId=%s, err=%v", order.ID, err)
			// 继续处理其他订单，不中断流程
			continue
		}
		s.log.Infof("导入手机号：成功更新订单手机号，orderId=%s, orderNumber=%s", order.ID, order.OrderNumber)
	}

	// 批量更新子订单手机号
	if len(needUpdateOrderList) > 0 {
		// 收集所有需要更新的订单ID
		orderIds := make([]string, 0, len(needUpdateOrderList))
		for _, order := range needUpdateOrderList {
			orderIds = append(orderIds, order.ID)
		}

		// 批量查询所有子订单
		subOrders, err := s.subOrderRepo.FindMultiByParentOrderIDS(ctx, orderIds)
		if err != nil {
			s.log.Errorf("导入手机号：批量查询子订单失败，err=%v", err)
			// 查询失败不影响主流程，继续执行
		} else if len(subOrders) > 0 {
			// 按父订单ID分组子订单
			parentOrderIdToSubOrdersMap := make(map[string][]*yanxue_model.SubOrder)
			for _, subOrder := range subOrders {
				if subOrder.ParentOrderID != "" {
					parentOrderIdToSubOrdersMap[subOrder.ParentOrderID] = append(parentOrderIdToSubOrdersMap[subOrder.ParentOrderID], subOrder)
				}
			}

			// 更新每个子订单的手机号
			updatedSubOrderCount := 0
			for parentOrderId, subOrderList := range parentOrderIdToSubOrdersMap {
				ph, exists := orderIdToPhMap[parentOrderId]
				if !exists || ph == "" {
					continue
				}

				// 更新该父订单的所有子订单
				for _, subOrder := range subOrderList {
					// 只更新手机号为空的子订单
					if subOrder.Ph == "" {
						oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
						oldSubOrder.Ph = ""
						subOrder.Ph = ph
						err := s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
						if err != nil {
							s.log.Errorf("导入手机号：更新子订单手机号失败，subOrderId=%s, parentOrderId=%s, err=%v", subOrder.ID, parentOrderId, err)
							// 继续处理其他子订单，不中断流程
							continue
						}
						updatedSubOrderCount++
						s.log.Infof("导入手机号：成功更新子订单手机号，subOrderId=%s, parentOrderId=%s, orderNumber=%s", subOrder.ID, parentOrderId, subOrder.OrderNumber)
					}
				}
			}

			if updatedSubOrderCount > 0 {
				s.log.Infof("导入手机号：批量更新子订单手机号完成，共更新 %d 个子订单", updatedSubOrderCount)
			}
		}
	}

	return reply, nil
}
