package data

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-redis/redis/v8"
	jwts "github.com/golang-jwt/jwt"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/jwt"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.UserRepo = (*UserRepo)(nil)

func NewUserRepo(
	config *conf.Bootstrap,
	logger log.Logger,
	data *Data,
	userRepo *yanxue_repo.UserRepo,
	smsNotifyHttpRpc *rpc.SmsNotifyHttpRpc,
) biz.UserRepo {
	l := log.NewHelper(log.With(logger, "module", "data/user"), log.WithMessageKey("message"))
	cfg, ok := config.Jwt["fwh"]
	if !ok {
		panic(errorx.TokenJwtConfigNotRequest.Err())
	}
	jwtConfig := &jwt.Config{
		AccessSecret: cfg.AccessSecret,
		AccessExpire: cfg.AccessExpire,
		RefreshAfter: cfg.RefreshAfter,
		Issuer:       cfg.Issuer,
	}
	j := jwt.NewJwt(jwtConfig, jwt.WithRedis(data.goRedisClient), jwt.WithCachePrefix(config.Name))
	return &UserRepo{
		log:              l,
		data:             data,
		jwt:              j,
		UserRepo:         userRepo,
		smsNotifyHttpRpc: smsNotifyHttpRpc,
	}
}

type UserRepo struct {
	log  *log.Helper
	data *Data
	jwt  *jwt.Jwt
	*yanxue_repo.UserRepo
	smsNotifyHttpRpc *rpc.SmsNotifyHttpRpc
}

func (s *UserRepo) GetDefaultNickName(phone string) string {
	// 手机号后 4 位
	phoneSuffix := phone[len(phone)-4:]
	return "研学" + phoneSuffix
}

// GenerateJwTToken 生成jwt
func (s *UserRepo) GenerateJwTToken(ctx context.Context, kv map[string]interface{}) (*jwt.Token, error) {
	token, _, err := s.jwt.GenerateToken(kv)
	if err != nil {
		return nil, errorx.TokenGenerationFailed.WithError(err).Err()
	}
	return token, nil
}

// CheckJwtTokenCheck jwt校验,并返回adminId
func (s *UserRepo) CheckJwtTokenCheck(ctx context.Context, token string) (jwts.MapClaims, error) {
	// token 校验
	claims, err := s.jwt.CheckToken(token)
	if err != nil {
		switch {
		case errors.Is(err, jwt.TokenExpired):
			return nil, errorx.TokenExpired.Err()
		case errors.Is(err, jwt.TokenInvalid):
			return nil, errorx.TokenInvalid.Err()
		case errors.Is(err, jwt.TokenGetErr):
			return nil, errorx.TokenPermissionChanged.Err()
		case errors.Is(err, jwt.TokenCheckErr):
			return nil, errorx.TokenOtherDeviceLogin.Err()
		default:
			return nil, errorx.TokenInvalid.Err()
		}
	}
	return claims, nil
}

// ExpiredToken 过期token
func (s *UserRepo) ExpiredToken(ctx context.Context, uids []string) error {
	for _, uid := range uids {
		err := s.jwt.ExpiredToken(uid)
		if err != nil {
			return err
		}
	}
	return nil
}

// SendSmsCode 发送短信验证码
func (a *UserRepo) SendSmsCode(ctx context.Context, phone, smsCode string) error {
	template := ""
	switch a.data.cfg.GetEnv() {
	case conf.GO_ENV_test:
		template = "洋葱研学-服务号"
	case conf.GO_ENV_stage:
		template = "洋葱研学-服务号"
	case conf.GO_ENV_production:
		template = "洋葱研学-服务号验证码"
	}
	err := a.smsNotifyHttpRpc.SendSms(ctx, &rpc.SendSmsReq{
		Phone:       []string{phone},
		Template:    template,
		FromService: a.data.cfg.GetName(),
		Params: map[string]string{
			"code": smsCode,
		},
	})
	if err != nil {
		return errorx.APIThirdErr.WithError(err).Err()
	}
	return nil
}

// 验证码-获取频率限制
// 一小时最多发送 3 次，一天最多发送 10 次
func (s *UserRepo) CheckSmsCodeFrequency(ctx context.Context, phone string) error {
	date := timeutil.NowCarbon().ToDateString()
	hour := timeutil.NowCarbon().Hour()
	cacheKey := cache.UserSmsCodeFrequency.Key(phone, date)
	hourCount, err := s.data.goRedisClient.HGet(ctx, cacheKey, strconv.Itoa(hour)).Int()
	if err != nil && err != redis.Nil {
		return err
	}
	if hourCount >= 3 {
		return errorx.SmsFrequencyLimit.WithError(fmt.Errorf("一小时内最多发送3次短信验证码")).Err()
	}
	dayCount, err := s.data.goRedisClient.HGet(ctx, cacheKey, "day").Int()
	if err != nil && err != redis.Nil {
		return err
	}
	if dayCount >= 10 {
		return errorx.SmsFrequencyLimit.WithError(fmt.Errorf("一天内最多发送10次短信验证码")).Err()
	}
	return nil
}

// 验证码-设置频率限制
func (s *UserRepo) SetSmsCodeFrequency(ctx context.Context, phone string) error {
	date := timeutil.NowCarbon().ToDateString()
	hour := timeutil.NowCarbon().Hour()
	cacheKey := cache.UserSmsCodeFrequency.Key(phone, date)
	// 设置小时和天级别限制
	_ = s.data.goRedisClient.HIncrBy(ctx, cacheKey, strconv.Itoa(hour), 1).Err()
	_ = s.data.goRedisClient.HIncrBy(ctx, cacheKey, "day", 1).Err()
	//设置过期时间
	_ = s.data.goRedisClient.Expire(ctx, cacheKey, cache.UserSmsCodeFrequency.TTL()).Err()
	return nil
}

// 验证码-存储code
func (s *UserRepo) SetSmsCode(ctx context.Context, smsId string, smsCode, phone, userWxId string) error {
	tmp := map[string]string{
		"smsCode":  smsCode,
		"phone":    phone,
		"userWxId": userWxId,
	}
	cacheValue, err := jsonutil.Marshal(tmp)
	if err != nil {
		return errorx.DataFormattingError.Err()
	}
	return s.data.goRedisClient.Set(ctx, cache.UserSmsCode.Key(smsId), cacheValue, cache.UserSmsCode.TTL()).Err()
}

// 验证码-校验code
func (s *UserRepo) CheckSmsCode(ctx context.Context, smsId string, smsCode string) (string, string, error) {
	cacheValue, err := s.data.goRedisClient.Get(ctx, cache.UserSmsCode.Key(smsId)).Result()
	if err != nil && err != redis.Nil {
		return "", "", errorx.DataRedisErr.Err()
	}
	code := map[string]string{}
	err = jsonutil.Unmarshal([]byte(cacheValue), &code)
	if err != nil {
		return "", "", errorx.DataFormattingError.Err()
	}
	if code["smsCode"] != smsCode {
		return "", "", errorx.SmsCodeInvalid.Err()
	}
	return code["phone"], code["userWxId"], nil
}
