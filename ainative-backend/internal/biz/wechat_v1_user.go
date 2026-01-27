package biz

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/ArtisanCloud/PowerLibs/v3/http/helper"
	"github.com/FrancisLv/PowerWeChat/v3/src/kernel"
	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/contract"
	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/messages"
	kernelModels "github.com/FrancisLv/PowerWeChat/v3/src/kernel/models"
	"github.com/FrancisLv/PowerWeChat/v3/src/miniProgram"
	"github.com/FrancisLv/PowerWeChat/v3/src/officialAccount"
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewWechatV1UserUseCase(
	cfg *conf.Bootstrap,
	logger log.Logger,
	officialAccountClient *officialAccount.OfficialAccount,
	userRepo UserRepo,
	userWxRepo UserWxRepo,
	smsNotifyHttpRpc *rpc.SmsNotifyHttpRpc,
	miniProgram *miniProgram.MiniProgram,
) *WechatV1UserUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1User"), log.WithMessageKey("message"))
	return &WechatV1UserUseCase{
		cfg:              cfg,
		log:              l,
		officialAccount:  officialAccountClient,
		userRepo:         userRepo,
		userWxRepo:       userWxRepo,
		smsNotifyHttpRpc: smsNotifyHttpRpc,
		miniProgram:      miniProgram,
	}
}

type WechatV1UserUseCase struct {
	cfg              *conf.Bootstrap
	log              *log.Helper
	officialAccount  *officialAccount.OfficialAccount
	miniProgram      *miniProgram.MiniProgram
	userRepo         UserRepo
	userWxRepo       UserWxRepo
	smsNotifyHttpRpc *rpc.SmsNotifyHttpRpc
}

func (w *WechatV1UserUseCase) GetSubscribeMessage() string {
	return fmt.Sprintf("🎉家长您好，欢迎关注【洋葱星球研学】家长中心\n\n🌍洋葱星球研学是属于洋葱学园下的子品牌，着力于提升孩子的综合素质，提升见识，让孩子在跨文化、跨学科、跨区域的小组活动中提升自身的核心素养。\n\n👉点这里预约营期<a href='' data-miniprogram-appid='%s' data-miniprogram-path='pages/recommend/index/index' >「洋葱星球研学官方小程序」</a>", w.cfg.GetXcx().GetAppID())
}

func (w *WechatV1UserUseCase) GetReplyMessage(str string) string {
	// 包含 预约 、约课、上课 购买、怎么买字段中的任意一个即可
	if strings.Contains(str, "预约") || strings.Contains(str, "约课") || strings.Contains(str, "上课") || strings.Contains(str, "购买") || strings.Contains(str, "怎么买") {
		return fmt.Sprintf("👉点这里进入<a href='' data-miniprogram-appid='%s' data-miniprogram-path='pages/recommend/index/index' >「洋葱星球研学官方小程序」</a>", w.cfg.GetXcx().GetAppID())
	}
	// 人工 电话 投诉
	if strings.Contains(str, "人工") || strings.Contains(str, "电话") || strings.Contains(str, "投诉") {
		return "您好，可联系您微信添加的购课服务老师或在服务号后台回复进行留言，我们会在工作日处理您的相关讯息"
	}
	// 其他
	return fmt.Sprintf("抱歉，无法识别您发送的内容\n\n1.如需预约营期和购买研学产品：点击<a href='' data-miniprogram-appid='%s' data-miniprogram-path='pages/recommend/index/index' >「洋葱星球研学官方小程序」</a>\n2.【人工服务】可联系您微信添加的购课服务老师 ", w.cfg.GetXcx().GetAppID())
}

func (w *WechatV1UserUseCase) OfficialAccountCallback(hw http.ResponseWriter, r *http.Request) {
	// 如果是 Get 请求，说明是微信服务器的验证请求
	if r.Method == http.MethodGet {
		// 验证微信服务器
		rs, err := w.officialAccount.Server.VerifyURL(r)
		if err != nil {
			w.log.WithContext(r.Context()).Errorf("officialAccountCallback err: %v", err)
			return
		}
		err = helper.HttpResponseSend(rs, hw)
		if err != nil {
			w.log.WithContext(r.Context()).Errorf("officialAccountCallback helper.HttpResponseSend err: %v", err)
			return
		}
		return
	}
	// 获取请求参数
	rs, err := w.officialAccount.Server.Notify(r, func(event contract.EventInterface) interface{} {
		switch event.GetMsgType() {
		case kernelModels.CALLBACK_MSG_TYPE_EVENT:
			// 获取 openid
			openID := event.GetFromUserName()
			// 处理用户信息
			err := w.OfficialAccountUserProcess(r.Context(), openID)
			if err != nil {
				w.log.WithContext(r.Context()).Errorf("officialAccountCallback err: %v", err)
			}
			switch event.GetEvent() {
			case "subscribe":
				return messages.NewText(w.GetSubscribeMessage())
			default:
				return kernel.SUCCESS_EMPTY_RESPONSE
			}
		case kernelModels.CALLBACK_MSG_TYPE_TEXT: // 文本消息
			fallthrough
		case kernelModels.CALLBACK_MSG_TYPE_IMAGE: // 图片消息
			fallthrough
		case kernelModels.CALLBACK_MSG_TYPE_VOICE: // 语音消息
			fallthrough
		case kernelModels.CALLBACK_MSG_TYPE_VIDEO: // 视频消息
			fallthrough
		case kernelModels.CALLBACK_MSG_TYPE_LOCATION: // 位置消息
			fallthrough
		case kernelModels.CALLBACK_MSG_TYPE_LINK: // 链接消息
			return messages.NewText(w.GetReplyMessage(string(event.GetContent())))
		default:
			// 这里回复success告诉微信我收到了，后续需要回复用户信息可以主动调发消息接口
			return kernel.SUCCESS_EMPTY_RESPONSE
		}
	})
	if err != nil {
		w.log.WithContext(r.Context()).Errorf("officialAccountCallback err: %v", err)
		return
	}
	err = helper.HttpResponseSend(rs, hw)
	if err != nil {
		w.log.WithContext(r.Context()).Errorf("officialAccountCallback helper.HttpResponseSend err: %v", err)
		return
	}
}

// OfficialAccountUserProcess 公众号用户信息处理
func (w *WechatV1UserUseCase) OfficialAccountUserProcess(ctx context.Context, openId string) error {
	if openId == "" {
		return nil
	}
	// 使用 openid 获取用户信息
	userInfo, err := w.officialAccount.User.Get(ctx, openId, "zh_CN")
	if err != nil {
		return err
	}
	// 获取unionid
	unionid := userInfo.UnionID
	// 现在订阅时有unionid，取消订阅时没有unionid
	if unionid != "" {
		// 保存用户信息到数据库
		userWx, err := w.userWxRepo.FindOneCacheByUnionid(ctx, unionid)
		if err != nil {
			return err
		}
		if userWx == nil || userWx.ID == "" {
			// 保存用户信息到数据库
			err = w.userWxRepo.CreateOneCache(ctx, &yanxue_model.UserWx{
				Unionid:           unionid,
				OffiaccountOpenID: userInfo.OpenID,
				OffiaccountFollow: userInfo.Subscribe == 1,
				Status:            1,
			})
			if err != nil {
				return err
			}
		} else {
			// 如果关注状态或 openid 发生变化，则更新数据库
			if userWx.OffiaccountFollow != (userInfo.Subscribe == 1) || userWx.OffiaccountOpenID != userInfo.OpenID {
				oldUserWx := w.userWxRepo.DeepCopy(userWx)
				userWx.OffiaccountOpenID = userInfo.OpenID
				userWx.OffiaccountFollow = userInfo.Subscribe == 1
				err = w.userWxRepo.UpdateOneCacheWithZero(ctx, userWx, oldUserWx)
				if err != nil {
					return err
				}
			}
		}
	} else {
		// 取消关注 没有unionid 则根据openid查询 只更新订阅状态
		userWxs, err := w.userWxRepo.FindMultiCacheByOffiaccountOpenID(ctx, openId)
		if err != nil {
			return err
		}
		if len(userWxs) > 0 {
			for _, userWx := range userWxs {
				oldUserWx := w.userWxRepo.DeepCopy(userWx)
				userWx.OffiaccountFollow = userInfo.Subscribe == 1
				err = w.userWxRepo.UpdateOneCacheWithZero(ctx, userWx, oldUserWx)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}
