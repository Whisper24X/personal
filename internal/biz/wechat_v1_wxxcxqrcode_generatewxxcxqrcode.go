package biz

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
)

// GenerateWxXcxQrcode 微信小程序码-生成小程序码
func (w *WechatV1WxXcxQrcodeUseCase) GenerateWxXcxQrcode(ctx context.Context, req *pb.GenerateWxXcxQrcodeReq) (*pb.GenerateWxXcxQrcodeReply, error) {
	resp := &pb.GenerateWxXcxQrcodeReply{}
	// 查询是否存在
	info, err := w.wxXcxQrcodeRepo.FindOneByPageScene(ctx, req.GetPage(), req.GetScene())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 如果存在，则返回
	if info != nil && info.ID != "" {
		resp.Token = info.Token
		resp.Url = info.URL
		return resp, nil
	}
	// 加锁
	err = w.commonRepo.AutoLockRetry(ctx, cache.WxXcxQrcodeTokenLock.Key(req.GetPage(), req.GetScene()), cache.WxXcxQrcodeTokenLock.TTL(), func() error {
		// 生成token
		token := cryptutil.Md5ToHex(req.GetPage() + req.GetScene())
		// 如果不存在，则生成小程序二维码
		qrcodeResp, err := w.miniProgram.WXACode.GetUnlimited(ctx, token, req.GetPage(), false, "release", 430, false, nil, false)
		if err != nil {
			return err
		}
		defer qrcodeResp.Body.Close()
		// 检查响应Content-Type，如果是JSON格式则说明返回了错误信息
		contentType := qrcodeResp.Header.Get("Content-Type")
		if strings.Contains(contentType, "application/json") || strings.Contains(contentType, "text/json") {
			return errorx.WxQrcodeGenerateErr.Err()
		}
		// 读取二进制图片数据
		imageData, err := io.ReadAll(qrcodeResp.Body)
		if err != nil {
			return errorx.WxQrcodeGenerateErr.WithError(err).Err()
		}
		// 创建临时文件保存图片
		tempFilePath := fmt.Sprintf("./wx_xcx_qrcode/qrcode_%s_%d.jpg", token, time.Now().Unix())
		err = fileutil.WriteContentCover(tempFilePath, string(imageData))
		if err != nil {
			return errorx.WxQrcodeGenerateErr.WithError(err).Err()
		}
		// 上传到OSS存储服务
		imageUrl, err := w.ycOssHttpRpc.UploadOss(ctx, tempFilePath)
		if err != nil {
			return errorx.WxQrcodeGenerateErr.WithError(err).Err()
		}
		// 清理临时文件
		defer func() {
			_ = os.Remove(tempFilePath)
		}()
		// 保存到数据库
		wxXcxQrcode := &yanxue_model.WxXcxQrcode{
			Token: token,
			Page:  req.GetPage(),
			Scene: req.GetScene(),
			URL:   imageUrl,
		}
		err = w.wxXcxQrcodeRepo.CreateOneCache(ctx, wxXcxQrcode)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Token = token
		resp.Url = imageUrl
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
