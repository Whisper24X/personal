package webhook

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFeiShu_SendMsg(t *testing.T) {
	feiShu := NewFeiShu("https://open.feishu.cn/open-apis/bot/v2/hook/389d384e-b903-4397-bb11-e24e5e0d8df6", "WN0snBGe31UMabPbYwk8ye")
	err := feiShu.SendText("测试")
	if err != nil {
		return
	}
	fmt.Println(err)
	assert.Equal(t, nil, err)
}

func TestFeiShu_SendCard(t *testing.T) {
	feiShu := NewFeiShu("https://open.feishu.cn/open-apis/bot/v2/hook/389d384e-b903-4397-bb11-e24e5e0d8df6", "WN0snBGe31UMabPbYwk8ye")
	card := Card{
		Elements: []CardElement{
			{
				Tag: "div",
				Text: CardElementsText{
					Content: "**西湖**，位于浙江省杭州市西湖区龙井路1号，杭州市区西部，景区总面积49平方千米，汇水面积为21.22平方千米，湖面面积为6.38平方千米。",
					Tag:     "lark_md",
				},
			},
			{
				Tag: "action",
				Actions: []CardAction{
					{
						Tag: "button",
						Text: CardActionText{
							Tag:     "plain_text",
							Content: "更多景点介绍 :玫瑰:",
						},
						URL:  "https://www.qq.com",
						Type: "primary",
					},
				},
			},
		},
		Header: CardHeader{
			Title: CardHeaderTitle{
				Content: "今日旅游推荐",
				Tag:     "plain_text",
			},
			Template: "blue",
		},
	}
	err := feiShu.SendCard(card)
	if err != nil {
		fmt.Println(err)
		return
	}
	assert.Equal(t, nil, err)
}
