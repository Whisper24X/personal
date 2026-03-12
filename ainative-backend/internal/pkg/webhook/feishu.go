package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/pkg/errors"
	"gitlab.yc345.tv/backend/go-logger/logger"
	"go.uber.org/zap"
)

type FeiShu struct {
	URL  string
	Sign string
}

func NewFeiShu(URL, Sign string) *FeiShu {
	return &FeiShu{
		URL:  URL,
		Sign: Sign,
	}
}

// GenSign 生成签名
func (f *FeiShu) GenSign(secret string, timestamp int64) (string, error) {
	// timestamp + key 做sha256, 再进行base64 encode
	stringToSign := fmt.Sprintf("%v", timestamp) + "\n" + secret

	var data []byte
	h := hmac.New(sha256.New, []byte(stringToSign))
	_, err := h.Write(data)
	if err != nil {
		return "", err
	}
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))
	return signature, nil
}

// SendText 文本消息
type SendText struct {
	Timestamp string `json:"timestamp"`
	Sign      string `json:"sign"`
	MsgType   string `json:"msg_type"`
	Content   struct {
		Text string `json:"text"`
	} `json:"content"`
}

// SendCard 卡片消息
type SendCard struct {
	Timestamp string `json:"timestamp"`
	Sign      string `json:"sign"`
	MsgType   string `json:"msg_type"`
	Card      Card   `json:"card"`
}

type CardElement struct {
	Tag             string                 `json:"tag"`
	Text            CardElementsText       `json:"text,omitempty"`
	ImgKey          string                 `json:"img_key,omitempty"`
	Alt             CardElementsAlt        `json:"alt,omitempty"`
	Mode            string                 `json:"mode,omitempty"`
	Preview         bool                   `json:"preview,omitempty"`
	Content         string                 `json:"content,omitempty"`
	Elements        []CardElementsElements `json:"elements,omitempty"`
	FlexMode        string                 `json:"flex_mode,omitempty"`
	BackgroundStyle string                 `json:"background_style,omitempty"`
	Columns         []CardElementsColumns  `json:"columns,omitempty"`
	Actions         []CardAction           `json:"actions"`
}

type CardElementsText struct {
	Content string `json:"content"`
	Tag     string `json:"tag"`
}

type CardElementsAlt struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type CardElementsElements struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type CardElementsColumns struct {
	Tag           string        `json:"tag"`
	Width         string        `json:"width"`
	Weight        int           `json:"weight"`
	VerticalAlign string        `json:"vertical_align"`
	Elements      []interface{} `json:"elements"`
}

type CardAction struct {
	Tag  string         `json:"tag"`
	Text CardActionText `json:"text"`
	Type string         `json:"type"`
	URL  string         `json:"url"`
}

type CardActionText struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type CardActionMultiUrl struct {
	Url        string `json:"url"`
	AndroidUrl string `json:"android_url"`
	IosUrl     string `json:"ios_url"`
	PcUrl      string `json:"pc_url"`
}

type CardHeader struct {
	Title    CardHeaderTitle `json:"title"`
	Template string          `json:"template"`
}

type CardHeaderTitle struct {
	Content string `json:"content"`
	Tag     string `json:"tag"`
}

type Card struct {
	Elements []CardElement `json:"elements"`
	Header   CardHeader
}

type RichTextContent struct {
	Tag    string `json:"tag"`
	Text   string `json:"text,omitempty"`
	Href   string `json:"href,omitempty"`
	UserId string `json:"user_id,omitempty"`
}

// SendRichText 富文本
type SendRichText struct {
	Timestamp string `json:"timestamp"`
	Sign      string `json:"sign"`
	MsgType   string `json:"msg_type"`
	Content   struct {
		Post struct {
			ZhCn struct {
				Title   string              `json:"title"`
				Content [][]RichTextContent `json:"content"`
			} `json:"zh_cn"`
		} `json:"post"`
	} `json:"content"`
}

// SendGroupCard 群名片
type SendGroupCard struct {
	Timestamp string `json:"timestamp"`
	Sign      string `json:"sign"`
	MsgType   string `json:"msg_type"`
	Content   struct {
		ShareChatId string `json:"share_chat_id"`
	} `json:"content"`
}

// SendImage 图片
type SendImage struct {
	MsgType string `json:"msg_type"`
	Content struct {
		ImageKey string `json:"image_key"`
	} `json:"content"`
}

func (f *FeiShu) req(body interface{}) error {
	resp, err := resty.New().R().SetBody(body).Post(f.URL)
	if err != nil {
		return err
	}
	if !resp.IsSuccess() {
		return errors.New(fmt.Sprintf("bad response status: %s", resp.Status()))
	}
	logger.WithContext(context.Background()).Info("发送飞书通知返回值", zap.String("feishu_response", string(resp.Body())))
	return nil
}

// SendText 发送文本消息
func (f *FeiShu) SendText(msg string) error {
	timestamp := time.Now().Unix()
	sign, err := f.GenSign(f.Sign, timestamp)
	if err != nil {
		return err
	}
	param := SendText{
		Timestamp: strconv.FormatInt(timestamp, 10),
		Sign:      sign,
		MsgType:   "text",
		Content: struct {
			Text string `json:"text"`
		}{
			Text: msg,
		},
	}
	err = f.req(param)
	if err != nil {
		return err
	}
	return nil
}

// SendCard 发送消息卡片
func (f *FeiShu) SendCard(card Card) error {
	timestamp := time.Now().Unix()
	sign, err := f.GenSign(f.Sign, timestamp)
	if err != nil {
		return err
	}
	param := SendCard{
		Timestamp: strconv.FormatInt(timestamp, 10),
		Sign:      sign,
		MsgType:   "interactive",
		Card:      card,
	}
	err = f.req(param)
	if err != nil {
		return err
	}
	return nil
}
