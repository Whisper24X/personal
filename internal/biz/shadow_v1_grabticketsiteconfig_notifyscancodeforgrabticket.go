package biz

import (
	"context"
	"errors"
	"io"
	"path/filepath"
	"strings"

	"github.com/go-kratos/kratos/v2/transport/http"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// 验证图片扩展名是否合法
func isValidImageExtension(ext string) bool {
	validExts := []string{".jpg", ".jpeg", ".png"}
	ext = strings.ToLower(ext)
	for _, valid := range validExts {
		if ext == valid {
			return true
		}
	}
	return false
}

// NotifyScanCodeForGrabTicket 研学抢票站点配置表-通知扫码
func (s *ShadowV1GrabTicketSiteConfigUseCase) NotifyScanCodeForGrabTicket(wr http.ResponseWriter, r *http.Request) error {
	// 获取图片文件
	file, header, err := r.FormFile("image")
	if err != nil {
		s.log.Errorf("Missing or invalid image file:", err.Error())
		return errorx.ParamErr.WithError(err).Err()
	}
	defer file.Close()
	content := r.FormValue("content")
	// 读取图片数据
	imageData, err := io.ReadAll(file)
	if err != nil {
		s.log.Errorf("Failed to read image data:", err.Error())
		return errorx.InternalServerError.WithError(err).Err()
	}

	// 验证图片大小
	if len(imageData) == 0 {
		return errorx.ParamErr.WithError(errors.New("图片大小不能为0")).Err()
	}
	if len(imageData) > 10*1024*1024 { // 10MB 限制
		return errorx.ParamErr.WithError(errors.New("图片大小不能超过10M")).Err()
	}

	// 验证图片格式
	ext := filepath.Ext(header.Filename)
	if !isValidImageExtension(ext) {
		return errorx.ParamErr.WithError(errors.New("图片格式只能为jpg，jpeg或png")).Err()
	}
	imgKey, err := s.httpRpc.FeiShuUploadImage(context.Background(), r)
	if err != nil {
		return err
	}
	s.log.Infof("imgKey: %s", imgKey)
	s.grabTicketSiteConfigRepo.ScanCodeForGrabTicketFeiShuNotify(context.Background(), content, imgKey)
	return nil
}
