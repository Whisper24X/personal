package biz

import (
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// ExportWechatPayBillCsv 导出微信支付账单CSV文件
func (s *ShadowV1OrderUseCase) ExportWechatPayBillCsv(ctx context.Context, billList []*yanxue_model.WechatPayBill, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// 写入表头
	headers := []string{
		"交易时间",
		"收支类型",
		"收入",
		"商品名称",
		"手续费",
		"微信订单号",
		"订单编号",
		"渠道订单编号",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	// 写入数据
	for _, bill := range billList {
		record := []string{
			timeutil.Carbon().ParseByLayout(bill.TradeTime.Format("2006-01-02 15:04:05"), "2006-01-02 15:04:05").ToDateTimeString(),
			bill.TransactionType,
			fmt.Sprintf("%.2f", bill.Amount),
			bill.GoodName,
			fmt.Sprintf("%.2f", bill.HandlingFee),
			bill.WechatOrderID,
			bill.OrderNumber,
			bill.ChannelOrderID,
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}

	return nil
}

// ExportWechatPayBill 导出微信账单
func (s *ShadowV1OrderUseCase) ExportWechatPayBill(ctx context.Context, req *pb.ExportWechatPayBillReq) (*pb.ExportWechatPayBillReply, error) {
	resp := &pb.ExportWechatPayBillReply{}

	// 解析开始和结束时间
	billStartTime := timeutil.Carbon().Parse(req.BillStartTime).ToStdTime()
	billEndTime := timeutil.Carbon().Parse(req.BillEndTime).ToStdTime()

	// 查询账单数据
	billList, err := s.wechatPayBillRepo.FindListByTradeTimeRange(ctx, billStartTime, billEndTime)
	if err != nil {
		s.log.Errorf("查询微信支付账单失败！err: %v", err)
		return resp, err
	}

	if len(billList) == 0 {
		s.log.Info("没有找到符合条件的账单数据")
		return resp, nil
	}

	key := cryptutil.Sha256(req.String())

	// 获取当前工作目录的绝对路径
	currentDir, err := os.Getwd()
	if err != nil {
		s.log.Errorf("获取当前工作目录失败！err: %v", err)
		return resp, err
	}
	dirPath := filepath.Join(currentDir, "yanxue-export", "wechat-pay-bill")
	// 检查目录是否存在，不存在则创建
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			s.log.Errorf("创建文件夹失败！err: %v", err)
			return resp, err
		}
	}
	path := filepath.Join(dirPath, fmt.Sprintf("%s_%s.csv", timeutil.NowCarbon().ToShortDateTimeString(), key))
	defer func() {
		_ = fileutil.Remove(path)
	}()

	// 生成csv文件
	err = s.ExportWechatPayBillCsv(ctx, billList, path)
	if err != nil {
		s.log.Errorf("生成CSV文件失败！err: %v", err)
		return resp, err
	}

	// 上传到oss
	downloadUrl, err := s.ycOssHttpRpc.UploadOss(ctx, path)
	if err != nil {
		s.log.Errorf("上传OSS失败！err: %v", err)
		return resp, err
	}

	s.log.Infof("导出微信支付账单成功，共 %d 条记录，下载链接: %s", len(billList), downloadUrl)
	resp.DownloadUrl = downloadUrl
	return resp, nil
}
