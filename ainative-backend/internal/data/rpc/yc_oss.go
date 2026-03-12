package rpc

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-resty/resty/v2"
	"github.com/google/uuid"
	"github.com/pkg/errors"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
)

func NewYcOssHttpRpc(logger log.Logger, cfg *conf.Bootstrap, restyClient *resty.Client) *YcOssHttpRpc {
	l := log.NewHelper(log.With(logger, "module", "data/ycOssHttpRpc"), log.WithMessageKey("message"))
	return &YcOssHttpRpc{
		log:         l,
		cfg:         cfg,
		restyClient: restyClient,
	}
}

type YcOssHttpRpc struct {
	log         *log.Helper
	cfg         *conf.Bootstrap
	restyClient *resty.Client
}

// UploadOss 上传oss
func (y *YcOssHttpRpc) UploadOss(ctx context.Context, path string) (string, error) {
	tokenCurl := "http://yc-oss.backsys/token"
	var accessToken string
	switch y.cfg.GetEnv() {
	case conf.GO_ENV_test:
		accessToken = "a20a3734-bd6d-462f-9c82-fa251509938e"
	case conf.GO_ENV_stage:
		accessToken = "3460096c-e92d-4c27-9e94-008ddbb842c2"
	case conf.GO_ENV_production:
		accessToken = "1ebb1607-0c33-4214-a9a2-bd70cee0eb21"
	default:
		return "", errors.New("UploadOss env not found")
	}
	// 1. 获取token
	tokenReq := map[string]string{
		"accessToken": accessToken,
		"bucket":      "onionpad-cloud-control-large",
		"expires":     "1800",
	}
	tokenResp, err := y.restyClient.R().SetContext(ctx).SetQueryParams(tokenReq).Post(tokenCurl)
	if err != nil {
		y.log.WithContext(ctx).Errorf("UploadOss token faild err: %v,", err)
		return "", err
	}
	if tokenResp.StatusCode() != http.StatusOK {
		y.log.WithContext(ctx).Errorf("UploadOss token NotStatusOK StatusCode:%d req: %+v resp: %s", tokenResp.StatusCode(), tokenReq, tokenResp.String())
		return "", err
	}
	type TokenReply struct {
		Code  int    `json:"code"`
		Msg   string `json:"msg"`
		Debug string `json:"debug"`
		Data  struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	var tokenReply TokenReply
	_ = json.Unmarshal(tokenResp.Body(), &tokenReply)
	if tokenReply.Data.Token == "" {
		return "", errors.New("UploadOss  未获取到token")
	}
	uploadCurl := "http://yc-oss.backsys/token/upload"
	uploadResp, err := y.restyClient.R().SetContext(ctx).SetFile("file", path).SetHeader("Authorization", tokenReply.Data.Token).SetFormData(map[string]string{
		"path": filepath.Join(y.cfg.GetName(), strings.TrimPrefix(filepath.Dir(path), "/"), strings.Replace(uuid.NewString(), "-", "", -1)) + filepath.Ext(path),
	}).Post(uploadCurl)
	if err != nil {
		y.log.WithContext(ctx).Errorf("UploadOss upload faild err: %v,", err)
		return "", err
	}
	if uploadResp.StatusCode() != http.StatusOK {
		y.log.WithContext(ctx).Errorf("UploadOss upload NotStatusOK StatusCode:%d path: %+v uploadResp: %s", uploadResp.StatusCode(), path, uploadResp.String())
		return "", err
	}
	type Reply struct {
		Code float64 `json:"code"`
		Data struct {
			Key                string `json:"key"`
			Domain             string `json:"domain"`
			IsThirdPartPrivate bool   `json:"isThirdPartPrivate"`
		} `json:"data"`
	}
	var reply Reply
	_ = json.Unmarshal(uploadResp.Body(), &reply)
	return fmt.Sprintf("%s/%s", reply.Data.Domain, reply.Data.Key), nil
}
