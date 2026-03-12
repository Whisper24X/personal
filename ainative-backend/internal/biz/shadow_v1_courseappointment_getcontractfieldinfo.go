package biz

import (
	"context"
	"strconv"
	"strings"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

var (
	digits   = []string{"零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"}
	units    = []string{"", "拾", "佰", "仟"}
	sections = []string{"", "万", "亿", "兆"}
)

// ConvertToRMBUpper 转换整数金额（精确到元）
func ConvertToRMBUpper(amount int64) string {
	if amount == 0 {
		return "零元整"
	} else if amount < 0 {
		return "负" + ConvertToRMBUpper(-amount)
	}

	// 拆分整数部分（单位：元）
	str := strconv.FormatInt(amount, 10)
	chinese := convertIntegerPart(str)

	// 添加前缀和后缀
	return chinese + "元整"
}

// 转换整数部分（每4位一组）
func convertIntegerPart(numStr string) string {
	result := ""
	zeroFlag := false // 标记是否出现零
	groupCount := (len(numStr) + 3) / 4

	for i := 0; i < groupCount; i++ {
		start := len(numStr) - (i+1)*4
		end := len(numStr) - i*4
		if start < 0 {
			start = 0
		}
		segment := numStr[start:end]

		// 转换当前4位组
		segStr, hasDigit := convertSegment(segment)

		// 零值规则处理
		switch {
		case segStr == "" && hasDigit: // 全零组但非最高位组
			if !zeroFlag {
				result = "零" + result
				zeroFlag = true
			}
		case segStr != "":
			// 添加组单位（万/亿）
			result = segStr + sections[groupCount-i-1] + result
			zeroFlag = false
		}
	}

	// 优化零显示（如"壹佰零万" -> "壹佰万"）
	return optimizeZero(result)
}

// 转换4位数字段
func convertSegment(seg string) (string, bool) {
	res := ""
	hasNonZero := false // 标记是否有非零数字

	for i := 0; i < len(seg); i++ {
		digit, _ := strconv.Atoi(string(seg[i]))
		if digit != 0 {
			// 处理"一十"开头的简写（如10->拾，非壹拾）
			if !(i == 0 && digit == 1 && len(seg) == 2) {
				res += digits[digit]
			}
			res += units[len(seg)-i-1] // 添加单位（拾/佰/仟）
			hasNonZero = true
		} else if res != "" && !strings.HasSuffix(res, "零") {
			res += "零" // 非连续零只加一个零
		}
	}
	return res, hasNonZero
}

// 零值优化规则
func optimizeZero(s string) string {
	// 移除连续的零（如"壹佰零零万" -> "壹佰万"）
	s = strings.ReplaceAll(s, "零零", "零")

	// 关键位置零处理（万/亿/元前的零可省略）
	patterns := []string{"零万", "零亿", "零兆"}
	for _, p := range patterns {
		if idx := strings.Index(s, p); idx != -1 {
			s = s[:idx] + s[idx+3:]
		}
	}
	return s
}

// parseAppointmentDate 解析预约日期，支持单个日期和日期范围格式
func parseAppointmentDate(dateStr string) (startTime, endTime time.Time, err error) {
	// 检查是否是日期范围格式 (例如: 2025-01-01到2025-01-06)
	if strings.Contains(dateStr, "到") {
		parts := strings.Split(dateStr, "到")
		if len(parts) != 2 {
			err = errorx.DataFormattingError.WithFmtMsg("invalid date range format").Err()
			return
		}

		startTime, err = time.Parse("2006-01-02", strings.TrimSpace(parts[0]))
		if err != nil {
			err = errorx.DataFormattingError.WithError(err).Err()
			return
		}

		endTime, err = time.Parse("2006-01-02", strings.TrimSpace(parts[1]))
		if err != nil {
			err = errorx.DataFormattingError.WithError(err).Err()
			return
		}
	} else {
		// 单个日期格式
		startTime, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			err = errorx.DataFormattingError.WithError(err).Err()
			return
		}
		endTime = startTime
	}

	return startTime, endTime, nil
}

// GetContractFieldInfo 获取合同字段信息
func (s *ShadowV1CourseAppointmentUseCase) GetContractFieldInfo(ctx context.Context, req *pb.GetContractFieldInfoReq) (*pb.GetContractFieldInfoReply, error) {
	resp := &pb.GetContractFieldInfoReply{}
	appointment, err := s.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	courseAppointment, err := s.courseAppointmentRepo.DTOShadowCourseAppointment(appointment)
	if err != nil {
		return resp, err
	}
	orderInfo, err := s.orderRepo.FindOneCacheByID(ctx, courseAppointment.OrderId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	orderPrice := orderInfo.OrderPrice

	goodInfo, err := s.goodRepo.FindOneCacheByChannelGoodID(ctx, orderInfo.ChannelGoodID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	content := &pb.GoodContent{}
	err = jsonutil.Unmarshal(goodInfo.Content, content)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	totalUseTime := int32(0)
	for _, category := range content.GoodCategories {
		totalUseTime += category.UseTimes
	}

	cost := int64(orderPrice / float32(totalUseTime))

	// 解析预约日期，支持单个日期和日期范围格式
	appointmentStartTime, appointmentEndTime, err := parseAppointmentDate(courseAppointment.Date)
	if err != nil {
		return resp, err
	}

	payEndDateTime := appointmentStartTime.AddDate(0, 0, -3)

	resp = &pb.GetContractFieldInfoReply{
		ParentName:        courseAppointment.ParentName,
		ParentPhone:       courseAppointment.ParentPhone,
		ChildName:         courseAppointment.StudentName,
		ChildId:           courseAppointment.StudentIdentityCard,
		ActivityStartDate: appointmentStartTime.Format("2006年1月2日"),
		ActivityEndDate:   appointmentEndTime.Format("2006年1月2日"),
		Cost:              strconv.FormatInt(cost, 10),
		CostCapital:       ConvertToRMBUpper(cost),
		PayEndDate:        payEndDateTime.Format("2006年1月2日"),
	}
	return resp, nil
}
