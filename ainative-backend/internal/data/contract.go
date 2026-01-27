package data

import (
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	urlpkg "net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-resty/resty/v2"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

var _ biz.EsignRepo = (*ESignRepo)(nil)

func NewESignRepo(
	logger log.Logger,
	data *Data,
) biz.EsignRepo {
	l := log.NewHelper(log.With(logger, "module", "data/esign"), log.WithMessageKey("message"))
	return &ESignRepo{
		log:  l,
		data: data,
	}
}

type ESignRepo struct {
	log  *log.Helper
	data *Data
}

// ESignConfig 存储e签宝API配置
type ESignConfig struct {
	AppID     string
	AppSecret string
	BaseURL   string
}

// GenerateSignature 生成签名
// 根据e签宝开放平台文档：https://open.esign.cn/doc/opendoc/dev-guide3/tggw2e#LkseX
func GenerateSignature(appId, secret, httpMethod, contentMD5, contentType, date, headers, url string) string {
	// 1. 组装签名参数
	signatureParams := []string{
		httpMethod,
		"*/*", // Accept
		contentMD5,
		contentType,
		date,
	}

	// 2. 添加headers参数（如果有）
	if headers != "" {
		signatureParams = append(signatureParams, headers)
	}

	// 3. 添加url参数（注意：这里只需要路径部分，不包含域名）
	// 如果url包含域名，则去掉域名，只保留路径部分
	parsedUrl := url
	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		if u, err := urlpkg.Parse(url); err == nil {
			parsedUrl = u.Path
			if u.RawQuery != "" {
				parsedUrl += "?" + u.RawQuery
			}
		}
	}
	signatureParams = append(signatureParams, parsedUrl)

	// 4. 组装待签名字符串
	stringToSign := strings.Join(signatureParams, "\n")

	// 5. 使用HmacSHA256算法计算签名
	// 参考文档：https://open.esign.cn/doc/opendoc/dev-guide3/tggw2e#LkseX
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(stringToSign))
	signatureBytes := mac.Sum(nil)
	// 对签名进行Base64编码
	signature := base64.StdEncoding.EncodeToString(signatureBytes)

	return signature
}

// CalculateContentMD5 计算请求体的MD5值
func CalculateContentMD5(requestBody []byte) string {
	md5Hash := md5.Sum(requestBody)
	return base64.StdEncoding.EncodeToString(md5Hash[:])
}

// GetCurrentDate 获取当前GMT时间
func GetCurrentDate() string {
	return time.Now().UTC().Format(time.RFC1123)
}

// CallEsignAPI 调用e签宝API的通用方法
func (r *ESignRepo) CallEsignAPI(method, apiURL, contentType, contentMD5 string, requestBody []byte, result interface{}) error {
	// 获取e签宝配置
	config := ESignConfig{
		AppID:     r.data.cfg.Yc.ESign.AppID,
		AppSecret: r.data.cfg.Yc.ESign.AppSecret,
		BaseURL:   r.data.cfg.Yc.ESign.BaseURL,
	}

	// 计算Content-MD5
	if contentMD5 == "" {
		contentMD5 = CalculateContentMD5(requestBody)
	}
	if contentType == "" {
		contentType = "application/json; charset=UTF-8"
	}

	date := GetCurrentDate()

	// 生成签名
	signature := GenerateSignature(config.AppID, config.AppSecret, method, contentMD5, contentType, date, "", apiURL)

	// 构建完整URL
	var fullURL string
	if strings.HasPrefix(apiURL, "http://") || strings.HasPrefix(apiURL, "https://") {
		fullURL = apiURL
	} else {
		fullURL = config.BaseURL + apiURL
	}

	// 创建请求并设置公共请求头
	req := r.data.restyClient.R().
		// 必选公共请求头
		SetHeader("X-Tsign-Open-App-Id", config.AppID).
		SetHeader("X-Tsign-Open-Auth-Mode", "Signature").
		SetHeader("X-Tsign-Open-Ca-Timestamp", fmt.Sprintf("%d", time.Now().UnixNano()/1e6)). // 毫秒级时间戳
		SetHeader("Content-Type", contentType).
		SetHeader("Accept", "*/*").
		// 可选公共请求头
		SetHeader("X-Tsign-Open-Ca-Signature", signature).
		SetHeader("Content-MD5", contentMD5).
		SetHeader("Date", date).
		SetHeader("Authorization", signature)

	// 设置请求体
	if len(requestBody) > 0 {
		req.SetBody(requestBody)
	}

	// 如果提供了结果结构体，设置结果接收器
	if result != nil {
		req.SetResult(result)
	}

	// 记录请求信息
	r.log.Infof("调用e签宝API: %s %s, 请求头: %v", method, apiURL, req.Header)

	// 发送请求
	var resp *resty.Response
	var err error

	switch method {
	case "GET":
		resp, err = req.Get(fullURL)
	case "POST":
		resp, err = req.Post(fullURL)
	case "PUT":
		resp, err = req.Put(fullURL)
	case "DELETE":
		resp, err = req.Delete(fullURL)
	default:
		return fmt.Errorf("不支持的HTTP方法: %s", method)
	}

	if err != nil {
		r.log.Errorf("调用e签宝API失败: %v", err)
		return err
	}

	// 记录响应信息
	r.log.Infof("e签宝API响应: 状态码=%d, 响应体=%s", resp.StatusCode(), resp.String())

	// 检查HTTP状态码
	if !resp.IsSuccess() {
		r.log.Errorf("e签宝API返回错误状态码: %d, 响应: %s", resp.StatusCode(), resp.String())
		return fmt.Errorf("API请求失败，状态码: %d, 响应: %s", resp.StatusCode(), resp.String())
	}

	return nil
}

// UploadFile 上传文件到e签宝平台
// 支持上传docx格式文件，会自动转换为PDF
func (r *ESignRepo) UploadFile(ctx context.Context, req *biz.UploadFileReq) (string, error) {
	// 读取文件内容
	fileBytes, err := os.ReadFile(req.FilePath)
	if err != nil {
		r.log.Errorf("读取文件失败: %v", err)
		return "", fmt.Errorf("读取文件失败: %v", err)
	}

	// 第一步：获取文件上传地址
	uploadURLAPI := "/v3/files/file-upload-url"

	// 准备获取上传地址的请求参数
	fileName := filepath.Base(req.FilePath)
	fileSize := int64(len(fileBytes))

	contentType := "application/octet-stream"

	// 计算MD5并编码
	md5Bytes := md5.Sum(fileBytes)
	contentMd5 := base64.StdEncoding.EncodeToString(md5Bytes[:])

	// 构建获取上传地址的请求体
	uploadURLReq := map[string]interface{}{
		"contentMd5":   contentMd5,
		"contentType":  contentType,
		"convertToPDF": req.ConvertToPDF,
		"fileName":     fileName,
		"fileSize":     fileSize,
	}

	reqJSON, err := json.Marshal(uploadURLReq)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return "", fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var uploadURLResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			FileUploadUrl string `json:"fileUploadUrl"`
			FileID        string `json:"fileId"`
		} `json:"data"`
	}

	// 调用API获取上传地址
	err = r.CallEsignAPI("POST", uploadURLAPI, "", "", reqJSON, &uploadURLResp)
	if err != nil {
		r.log.Errorf("获取文件上传地址失败: %v", err)
		return "", fmt.Errorf("获取文件上传地址失败: %v", err)
	}

	if uploadURLResp.Code != 0 {
		r.log.Errorf("获取文件上传地址失败: %s", uploadURLResp.Message)
		return "", fmt.Errorf("获取文件上传地址失败: %s", uploadURLResp.Message)
	}

	// 第二步：上传文件到指定地址
	// 使用CallEsignAPI方法上传文件
	var uploadResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	// 从完整URL中提取路径部分，去掉host
	fileUploadURL := uploadURLResp.Data.FileUploadUrl
	err = r.CallEsignAPI("PUT", fileUploadURL, contentType, contentMd5, fileBytes, &uploadResp)

	if err != nil {
		r.log.Errorf("上传文件失败: %v", err)
		return "", fmt.Errorf("上传文件失败: %v", err)
	}

	if uploadResp.Code != 0 {
		r.log.Errorf("上传文件失败: %s", uploadResp.Message)
		return "", fmt.Errorf("上传文件失败: %s", uploadResp.Message)
	}

	r.log.Infof("文件上传成功，文件ID: %s", uploadURLResp.Data.FileID)

	return uploadURLResp.Data.FileID, nil
}

// SignContract 签署合同
func (r *ESignRepo) SignContract(ctx context.Context, req *biz.UploadFileReq, fileId string) (string, string, error) {
	var fileInfo *FileInfoResponse
	var err error
	// 获取文件信息, 只有状态为2和5才是准备就绪
	// 如果还没有就绪，则重试等待
	for i := 0; i < 5; i++ {
		fileInfo, err = r.GetFileInfo(ctx, fileId)
		if err != nil {
			r.log.Errorf("获取文件信息失败: %v", err)
			return "", "", fmt.Errorf("获取文件信息失败: %v", err)
		}
		if fileInfo.Data.FileStatus != constant.ESignFileUploadSuccess && fileInfo.Data.FileStatus != constant.ESignFileConvertSuccess {
			time.Sleep(time.Second)
			continue
		} else {
			break
		}
	}
	if fileInfo == nil || fileInfo.Data.FileID == "" {
		r.log.Errorf("获取文件信息失败: %v", err)
		return "", "", fmt.Errorf("获取文件信息失败: %v", err)
	}

	r.log.Infof("文件信息: %+v", fileInfo)

	// 关键词列表
	keywordList := []string{constant.PartyASealPositionKeyword, constant.PartyBSealPositionKeyword}
	if req.ContractType == constant.ContractTypeMultiDay {
		keywordList = append(keywordList, constant.PartyCSealPositionKeyword)
	}

	positions, err := r.GetKeywordPositions(ctx, fileId, keywordList)

	if err != nil {
		r.log.Errorf("获取关键字位置失败: %v", err)
		return "", "", fmt.Errorf("获取关键字位置失败: %v", err)
	}

	r.log.Infof("关键字位置: %+v", positions)

	var partyASealPositionX, partyASealPositionY, partyBSealPositionX, partyBSealPositionY, partyCSealPositionX, partyCSealPositionY float64
	var partyASealPositionPage, partyBSealPositionPage, partyCSealPositionPage int32
	if len(positions.Data.KeywordPositions) > 0 {
		for _, positionItem := range positions.Data.KeywordPositions {
			if positionItem.Keyword == constant.PartyASealPositionKeyword {
				if len(positionItem.Positions) > 0 && len(positionItem.Positions[0].Coordinates) > 0 {
					partyASealPositionX = positionItem.Positions[0].Coordinates[0].PositionX
					partyASealPositionY = positionItem.Positions[0].Coordinates[0].PositionY
					partyASealPositionPage = positionItem.Positions[0].PageNum
				} else {
					r.log.Warnf("未找到关键字位置")
					return "", "", errorx.APIThirdErr.WithError(errors.New("未找到甲方盖章位置！请确认合同文件是否正确！")).Err()
				}
			} else if positionItem.Keyword == constant.PartyBSealPositionKeyword {
				if len(positionItem.Positions) > 0 && len(positionItem.Positions[0].Coordinates) > 0 {
					partyBSealPositionX = positionItem.Positions[0].Coordinates[0].PositionX
					partyBSealPositionY = positionItem.Positions[0].Coordinates[0].PositionY
					partyBSealPositionPage = positionItem.Positions[0].PageNum
				} else {
					r.log.Warnf("未找到关键字位置")
					return "", "", errorx.APIThirdErr.WithError(errors.New("未找到乙方盖章位置！请确认合同文件是否正确！")).Err()
				}
			} else if positionItem.Keyword == constant.PartyCSealPositionKeyword {
				if len(positionItem.Positions) > 0 && len(positionItem.Positions[0].Coordinates) > 0 {
					partyCSealPositionX = positionItem.Positions[0].Coordinates[0].PositionX
					partyCSealPositionY = positionItem.Positions[0].Coordinates[0].PositionY
					partyCSealPositionPage = positionItem.Positions[0].PageNum
				} else {
					r.log.Warnf("未找到关键字位置")
					return "", "", errorx.APIThirdErr.WithError(errors.New("未找到丙方盖章位置！请确认合同文件是否正确！")).Err()
				}
			}
		}
	}

	// 创建签署流程
	// 将页码转换为字符串
	partyASealPositionPageStr := strconv.Itoa(int(partyASealPositionPage))
	partyBSealPositionPageStr := strconv.Itoa(int(partyBSealPositionPage))
	partyCSealPositionPageStr := strconv.Itoa(int(partyCSealPositionPage))
	createSignFlowReq := &CreateSignFlowReq{
		FileId:                 fileId,
		PartyASealPositionX:    partyASealPositionX + 155,
		PartyASealPositionY:    partyASealPositionY + 5,
		PartyASealPositionPage: partyASealPositionPageStr,
		PartyBSealPositionX:    partyBSealPositionX + 155,
		PartyBSealPositionY:    partyBSealPositionY - 10,
		PartyBSealPositionPage: partyBSealPositionPageStr,
		PartyCSealPositionX:    partyCSealPositionX + 155,
		PartyCSealPositionY:    partyCSealPositionY - 30,
		PartyCSealPositionPage: partyCSealPositionPageStr,
		PsnAccount:             req.PsnAccount,
		PsnName:                req.PsnName,
		ContractName:           req.ContractName,
		ActivityStartDate:      req.ActivityStartDate,
		ThirdCompanyName:       req.ThirdCompanyName,
		ThirdCompanyAccount:    req.ThirdCompanyAccount,
		ThirdCompanyPsnName:    req.ThirdCompanyPsnName,
		ContractType:           req.ContractType,
		PsnId:                  r.data.cfg.Yc.ESign.PsnID,
		OrgId:                  r.data.cfg.Yc.ESign.OrgID,
	}
	flowID, err := r.CreateSignFlowByFile(ctx, createSignFlowReq)
	if err != nil {
		r.log.Errorf("创建签署流程失败: %v", err)
		return "", "", fmt.Errorf("创建签署流程失败: %v", err)
	}
	r.log.Infof("签署流程创建成功，流程ID: %s", flowID)

	signURL, err := r.GetSignURL(ctx, flowID, req.PsnAccount)
	if err != nil {
		r.log.Errorf("获取签署地址失败: %v", err)
		return "", "", fmt.Errorf("获取签署地址失败: %v", err)
	}
	r.log.Infof("签署地址: %s", signURL)

	return flowID, signURL, nil
}

// FileInfoResponse 文件信息响应结构体
type FileInfoResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		FileID          string `json:"fileId"`          // 文件ID
		FileName        string `json:"fileName"`        // 文件名称
		FileStatus      int    `json:"fileStatus"`      // 文件状态
		FileDownloadUrl string `json:"fileDownloadUrl"` // 文件下载地址
	} `json:"data"`
}

// KeywordPositionsRequest 关键字定位请求结构体
type KeywordPositionsRequest struct {
	FileID   string   `json:"fileId"`   // 文件ID
	Keywords []string `json:"keywords"` // 关键字列表
}

// KeywordPositionsResponse 关键字定位响应结构体
type KeywordPositionsResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		KeywordPositions []KeywordPosition `json:"keywordPositions"` // 关键字位置列表
	} `json:"data"`
}

// KeywordPosition 关键字位置结构体
type KeywordPosition struct {
	Keyword   string     `json:"keyword"`   // 关键字
	Positions []Position `json:"positions"` // 位置列表
}

type Coordinates struct {
	PositionX float64 `json:"positionX"` // X坐标
	PositionY float64 `json:"positionY"` // Y坐标
}

// Position 位置结构体
type Position struct {
	Coordinates []Coordinates `json:"coordinates"` // 坐标
	PageNum     int32         `json:"pageNum"`     // 关键字所在页码
}

// GetKeywordPositions 获取文件中关键字位置
func (r *ESignRepo) GetKeywordPositions(ctx context.Context, fileID string, keywords []string) (*KeywordPositionsResponse, error) {
	// API路径
	keywordPositionsAPI := fmt.Sprintf("/v3/files/%s/keyword-positions", fileID)

	// 构建请求参数
	reqData := KeywordPositionsRequest{
		FileID:   fileID,
		Keywords: keywords,
	}

	// 将请求参数转换为JSON
	requestBody, err := json.Marshal(reqData)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return nil, fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var keywordPositionsResp KeywordPositionsResponse

	// 调用API获取关键字位置
	err = r.CallEsignAPI("POST", keywordPositionsAPI, "application/json; charset=UTF-8", "", requestBody, &keywordPositionsResp)
	if err != nil {
		r.log.Errorf("获取关键字位置失败: %v", err)
		return nil, fmt.Errorf("获取关键字位置失败: %v", err)
	}

	if keywordPositionsResp.Code != 0 {
		r.log.Errorf("获取关键字位置失败: %s", keywordPositionsResp.Message)
		return nil, fmt.Errorf("获取关键字位置失败: %s", keywordPositionsResp.Message)
	}

	r.log.Infof("获取关键字位置成功，文件ID: %s", fileID)
	return &keywordPositionsResp, nil
}

// GetFileInfo 获取文件信息
func (r *ESignRepo) GetFileInfo(ctx context.Context, fileID string) (*FileInfoResponse, error) {
	// API路径
	getFileInfoAPI := fmt.Sprintf("/v3/files/%s", fileID)

	// 准备响应结构
	var fileInfoResp FileInfoResponse

	// 调用API获取文件信息
	err := r.CallEsignAPI("GET", getFileInfoAPI, "", "", nil, &fileInfoResp)
	if err != nil {
		r.log.Errorf("获取文件信息失败: %v", err)
		return nil, fmt.Errorf("获取文件信息失败: %v", err)
	}

	if fileInfoResp.Code != 0 {
		r.log.Errorf("获取文件信息失败: %s", fileInfoResp.Message)
		return nil, fmt.Errorf("获取文件信息失败: %s", fileInfoResp.Message)
	}

	r.log.Infof("获取文件信息成功，文件ID: %s", fileID)
	return &fileInfoResp, nil
}

// IdentityInfoResponse 个人认证信息
type IdentityInfoResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		PsnId string `json:"psnId"` // 个人账号ID
	} `json:"data"`
}

// GetIdentityInfo 获取个人认证信息
func (r *ESignRepo) GetIdentityInfo(ctx context.Context, psnAccount string) (*IdentityInfoResponse, error) {
	// API路径
	getFileInfoAPI := fmt.Sprintf("/v3/persons/identity-info?psnAccount=%s", psnAccount)

	// 准备响应结构
	var identityInfoResponse IdentityInfoResponse

	// 调用API获取文件信息
	err := r.CallEsignAPI("GET", getFileInfoAPI, "", "", nil, &identityInfoResponse)
	if err != nil {
		r.log.Errorf("获取个人认证信息失败: %v", err)
		return nil, fmt.Errorf("获取个人认证信息失败: %v", err)
	}

	if identityInfoResponse.Code != 0 {
		r.log.Errorf("获取个人认证信息失败: %s", identityInfoResponse.Message)
		return nil, fmt.Errorf("获取个人认证信息失败: %s", identityInfoResponse.Message)
	}

	r.log.Infof("获取个人认证信息成功，个人账号标识: %s", psnAccount)
	return &identityInfoResponse, nil
}

type CreateSignFlowReq struct {
	FileId                 string
	PartyASealPositionX    float64 // 甲方盖章X坐标
	PartyASealPositionY    float64 // 甲方盖章Y坐标
	PartyASealPositionPage string  // 甲方盖章页码
	PartyBSealPositionX    float64 // 乙方盖章X坐标
	PartyBSealPositionY    float64 // 乙方盖章Y坐标
	PartyBSealPositionPage string  // 乙方盖章页码
	PartyCSealPositionX    float64 // 丙方盖章X坐标
	PartyCSealPositionY    float64 // 丙方盖章Y坐标
	PartyCSealPositionPage string  // 丙方盖章页码
	PsnAccount             string  // 客户手机号
	PsnName                string  // 客户姓名
	ContractName           string  // 合同名称
	ActivityStartDate      string  // 营期开始时间
	ThirdCompanyName       string  // 第三方公司名称
	ThirdCompanyAccount    string  // 第三方公司经办人账号（手机号）
	ThirdCompanyPsnName    string  // 第三方公司经办人姓名
	ContractType           int32   // 合同类型：1：单日营；2：多日营
	PsnId                  string  // 个人账号ID(合同发起方，不传默认是公司)
	OrgId                  string  // 机构账号ID
}

// CreateSignFlowByFile 创建签署流程
func (r *ESignRepo) CreateSignFlowByFile(ctx context.Context, req *CreateSignFlowReq) (string, error) {
	// API路径
	createFlowAPI := "/v3/sign-flow/create-by-file"

	// 解析营期开始时间
	activityStartTime, parseErr := time.Parse("2006年1月2日", req.ActivityStartDate)
	if parseErr != nil {
		r.log.Errorf("解析营期开始时间失败: %v, 原始值: %s", parseErr, req.ActivityStartDate)
		return "", fmt.Errorf("解析营期开始时间失败: %v", parseErr)
	}

	// 计算当天23:59:59的时间戳（毫秒）
	expireTime := time.Date(
		activityStartTime.Year(),
		activityStartTime.Month(),
		activityStartTime.Day(),
		23, 59, 59, 0,
		activityStartTime.Location(),
	)

	// 转换为毫秒时间戳
	signFlowExpireTimeMs := expireTime.UnixNano() / int64(time.Millisecond)
	// 构建请求参数
	var signersMapList []map[string]interface{}
	if req.ContractType == constant.ContractTypeSingleDay { // 单日营
		signersMapList = []map[string]interface{}{
			// 甲方
			{
				"signerType": 0, // 签署方类型：0 - 个人，1 -企业/机构，2 - 法定代表人，3 - 经办人
				"signFields": []map[string]interface{}{
					{
						"fileId": req.FileId,
						"normalSignFieldConfig": map[string]interface{}{
							"signFieldStyle": 1, // 1：单页签章
							"signFieldPosition": map[string]interface{}{
								"positionPage": req.PartyASealPositionPage,
								"positionX":    req.PartyASealPositionX,
								"positionY":    req.PartyASealPositionY,
							},
						},
					},
				},
				"psnSignerInfo": map[string]interface{}{
					"psnAccount": req.PsnAccount,
					"psnInfo": map[string]interface{}{
						"psnName": req.PsnName,
					},
				},
			},
			// 乙方
			{
				"signerType": 1, // 签署方类型：0 - 个人，1 -企业/机构，2 - 法定代表人，3 - 经办人
				"signFields": []map[string]interface{}{
					{
						"fileId": req.FileId,
						"normalSignFieldConfig": map[string]interface{}{
							"assignedSealId": r.data.cfg.Yc.ESign.SealID,
							"autoSign":       true,
							"signFieldStyle": 1, // 1：单页签章
							"signFieldPosition": map[string]interface{}{
								"positionPage": req.PartyBSealPositionPage,
								"positionX":    req.PartyBSealPositionX,
								"positionY":    req.PartyBSealPositionY,
							},
						},
					},
				},
			},
		}
	} else if req.ContractType == constant.ContractTypeMultiDay { // 多日营
		signersMapList = []map[string]interface{}{
			// 甲方
			{
				"signerType": 0, // 签署方类型：0 - 个人，1 -企业/机构，2 - 法定代表人，3 - 经办人
				"signFields": []map[string]interface{}{
					{
						"fileId": req.FileId,
						"normalSignFieldConfig": map[string]interface{}{
							"signFieldStyle": 1, // 1：单页签章
							"signFieldPosition": map[string]interface{}{
								"positionPage": req.PartyASealPositionPage,
								"positionX":    req.PartyASealPositionX,
								"positionY":    req.PartyASealPositionY,
							},
						},
					},
				},
				"psnSignerInfo": map[string]interface{}{
					"psnAccount": req.PsnAccount,
					"psnInfo": map[string]interface{}{
						"psnName": req.PsnName,
					},
				},
			},
			// 乙方
			{
				"signerType": 1, // 签署方类型：0 - 个人，1 -企业/机构，2 - 法定代表人，3 - 经办人
				"signFields": []map[string]interface{}{
					{
						"fileId": req.FileId,
						"normalSignFieldConfig": map[string]interface{}{
							"autoSign":       false,
							"signFieldStyle": 1, // 1：单页签章
							"signFieldPosition": map[string]interface{}{
								"positionPage": req.PartyBSealPositionPage,
								"positionX":    req.PartyBSealPositionX,
								"positionY":    req.PartyBSealPositionY,
							},
						},
					},
				},
				"orgSignerInfo": map[string]interface{}{
					"orgName": req.ThirdCompanyName, // 企业名称
					"transactorInfo": map[string]interface{}{
						"psnAccount": req.ThirdCompanyAccount, // 经办人账号
						"psnInfo": map[string]interface{}{
							"psnName": req.ThirdCompanyPsnName, // 经办人姓名
						},
					},
				},
			},
			// 丙方
			{
				"signerType": 1, // 签署方类型：0 - 个人，1 -企业/机构，2 - 法定代表人，3 - 经办人
				"signFields": []map[string]interface{}{
					{
						"fileId": req.FileId,
						"normalSignFieldConfig": map[string]interface{}{
							"assignedSealId": r.data.cfg.Yc.ESign.SealID,
							"autoSign":       true,
							"signFieldStyle": 1, // 1：单页签章
							"signFieldPosition": map[string]interface{}{
								"positionPage": req.PartyCSealPositionPage,
								"positionX":    req.PartyCSealPositionX,
								"positionY":    req.PartyCSealPositionY,
							},
						},
					},
				},
			},
		}
	}

	reqData := map[string]interface{}{
		"signFlowConfig": map[string]interface{}{
			"signFlowTitle":      req.ContractName,
			"autoFinish":         true,
			"signFlowExpireTime": signFlowExpireTimeMs, // 营期开始当天23点59分59秒
			"noticeConfig": map[string]interface{}{
				"noticeTypes": "1", // 通知类型：1 - 短信
			},
		},
		"docs": []map[string]interface{}{
			{
				"fileId": req.FileId,
			},
		},
		"signers": signersMapList,
		"signFlowInitiator": map[string]interface{}{
			"orgInitiator": map[string]interface{}{
				"orgId": req.OrgId,
				"transactor": map[string]interface{}{
					"psnId": req.PsnId,
				},
			},
		},
	}

	// 序列化请求参数
	reqJSON, err := json.Marshal(reqData)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return "", fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var createFlowResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			SignFlowId string `json:"signFlowId"`
		} `json:"data"`
	}

	// 调用API创建签署流程
	err = r.CallEsignAPI("POST", createFlowAPI, "", "", reqJSON, &createFlowResp)
	if err != nil {
		r.log.Errorf("创建签署流程失败: %v", err)
		return "", fmt.Errorf("创建签署流程失败: %v", err)
	}

	if createFlowResp.Code != 0 {
		r.log.Errorf("创建签署流程失败: %s", createFlowResp.Message)
		return "", fmt.Errorf("创建签署流程失败: %s", createFlowResp.Message)
	}

	r.log.Infof("签署流程创建成功，流程ID: %s", createFlowResp.Data.SignFlowId)
	return createFlowResp.Data.SignFlowId, nil
}

// GetSignURL 获取签署地址
func (r *ESignRepo) GetSignURL(ctx context.Context, signFlowID, psnAccount string) (string, error) {
	// API路径
	signURLAPI := fmt.Sprintf("/v3/sign-flow/%s/sign-url", signFlowID)

	// 构建请求参数
	reqData := map[string]interface{}{
		"signFlowId": signFlowID,
		"operator": map[string]interface{}{
			"psnAccount": psnAccount,
		},
	}

	// 序列化请求参数
	reqJSON, err := json.Marshal(reqData)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return "", fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var signURLResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			ShortUrl string `json:"shortUrl"` // 签署短链接
			Url      string `json:"url"`      // 签署长链接
		} `json:"data"`
	}

	// 调用API获取签署地址
	err = r.CallEsignAPI("POST", signURLAPI, "", "", reqJSON, &signURLResp)
	if err != nil {
		r.log.Errorf("获取签署地址失败: %v", err)
		return "", fmt.Errorf("获取签署地址失败: %v", err)
	}

	if signURLResp.Code != 0 {
		r.log.Errorf("获取签署地址失败: %s", signURLResp.Message)
		return "", fmt.Errorf("获取签署地址失败: %s", signURLResp.Message)
	}

	r.log.Infof("获取签署地址成功，流程ID: %s", signFlowID)

	// 返回短链接，如果需要长链接可以修改返回signURLResp.Data.Url
	return signURLResp.Data.ShortUrl, nil
}

// GetSignFlowDetail 查询签署流程详情
func (r *ESignRepo) GetSignFlowDetail(ctx context.Context, signFlowID string) (int32, error) {
	// API路径
	signFlowDetailAPI := fmt.Sprintf("/v3/sign-flow/%s/detail", signFlowID)

	// 构建请求参数
	reqData := map[string]string{
		"signFlowId": signFlowID,
	}

	// 序列化请求参数
	reqJSON, err := json.Marshal(reqData)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return -1, fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var signFlowDetailResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			SignFlowStatus int32 `json:"signFlowStatus"` // 当前流程的状态：0-草稿；1-签署中；2-完成；3-撤销；5-过期；7-拒签；
		} `json:"data"`
	}

	// 调用API获取签署地址
	err = r.CallEsignAPI("GET", signFlowDetailAPI, "", "", reqJSON, &signFlowDetailResp)
	if err != nil {
		r.log.Errorf("查询签署流程详情: %v", err)
		return -1, fmt.Errorf("查询签署流程详情: %v", err)
	}

	if signFlowDetailResp.Code != 0 {
		r.log.Errorf("查询签署流程详情: %s", signFlowDetailResp.Message)
		return -1, fmt.Errorf("查询签署流程详情: %s", signFlowDetailResp.Message)
	}

	return signFlowDetailResp.Data.SignFlowStatus, nil
}

// UrgeSignFlow 催签流程中签署人
// https://open.esign.cn/doc/opendoc/pdf-sign3/yws940
func (r *ESignRepo) UrgeSignFlow(ctx context.Context, signFlowID, psnAccount string) (bool, error) {
	// API路径
	UrgeSignFlowAPI := fmt.Sprintf("/v3/sign-flow/%s/urge", signFlowID)

	// 构建请求参数
	reqData := map[string]interface{}{
		"signFlowId":  signFlowID,
		"noticeTypes": "1", // 通知方式：1-短信
		"urgedOperator": map[string]interface{}{
			"psnAccount": psnAccount,
		},
	}

	// 序列化请求参数
	reqJSON, err := json.Marshal(reqData)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return false, fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var UrgeSignFlowResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	// 调用API催签流程中签署人
	err = r.CallEsignAPI("POST", UrgeSignFlowAPI, "", "", reqJSON, &UrgeSignFlowResp)
	if err != nil {
		r.log.Errorf("催签流程中签署人失败: %v", err)
		return false, fmt.Errorf("催签流程中签署人失败: %v", err)
	}

	if UrgeSignFlowResp.Code != 0 {
		r.log.Errorf("催签流程中签署人失败: %s", UrgeSignFlowResp.Message)
		return false, fmt.Errorf("催签流程中签署人失败: %s", UrgeSignFlowResp.Message)
	}

	r.log.Infof("催签流程中签署人成功，流程ID: %s", signFlowID)

	return true, nil
}

// RevokeSignFlow 撤销签署流程
// https://open.esign.cn/doc/opendoc/pdf-sign3/klbicu
func (r *ESignRepo) RevokeSignFlow(ctx context.Context, signFlowID, revokeReason string) (bool, error) {
	// API路径
	revokeSignFlowAPI := fmt.Sprintf("/v3/sign-flow/%s/revoke", signFlowID)

	// 构建请求参数
	reqData := map[string]interface{}{
		"signFlowId":   signFlowID,
		"revokeReason": revokeReason,
	}

	// 序列化请求参数
	reqJSON, err := json.Marshal(reqData)
	if err != nil {
		r.log.Errorf("序列化请求参数失败: %v", err)
		return false, fmt.Errorf("序列化请求参数失败: %v", err)
	}

	// 准备响应结构
	var revokeSignFlowResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	// 调用API撤销签署流程
	err = r.CallEsignAPI("POST", revokeSignFlowAPI, "", "", reqJSON, &revokeSignFlowResp)
	if err != nil {
		r.log.Errorf("撤销签署流程失败: %v", err)
		return false, fmt.Errorf("撤销签署流程失败: %v", err)
	}

	if revokeSignFlowResp.Code != 0 {
		r.log.Errorf("撤销签署流程失败: %s", revokeSignFlowResp.Message)
		return false, fmt.Errorf("撤销签署流程失败: %s", revokeSignFlowResp.Message)
	}

	r.log.Infof("撤销签署流程成功，流程ID: %s", signFlowID)

	return true, nil
}
