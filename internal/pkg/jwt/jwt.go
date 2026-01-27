package jwt

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/gogf/gf/v2/util/gconv"
	jwts "github.com/golang-jwt/jwt"
	"github.com/pkg/errors"
)

var (
	TokenExpired  = errors.New("token is expired")
	TokenInvalid  = errors.New("token is invalid")
	UIDNotRequest = errors.New("uid not request")
	TokenStoreErr = errors.New("token store fail")
	TokenGetErr   = errors.New("token get fail")
	TokenCheckErr = errors.New("token check fail")
)

type Config struct {
	AccessSecret string // 秘钥
	AccessExpire int64  // 过期时间
	RefreshAfter int64  // 刷新时间 (小于过期时间,大于刷新时间,而小于过期时间,则刷新)
	Issuer       string // 签发人
}

type Token struct {
	Token     string `json:"token"`
	ExpiredAt int64  `json:"expired_at"`
	RefreshAt int64  `json:"refresh_at"`
}

type Jwt struct {
	Cfg         *Config
	redis       *redis.Client
	CachePrefix string
}

const (
	// jwt 官方定义
	JwtAudience  = "aud" // 受众
	JwtId        = "jti" // 编号
	JwtIssueAt   = "iat" // 签发时间
	JwtExpired   = "exp" // 过期时间
	JwtIssuer    = "iss" // 签发人
	JwtNotBefore = "nbf" // 生效时间，在此之前是无效的
	JwtSubject   = "sub" // 主题

	// 自定义
	JwtRefresh = "ref" // 刷新时间
	JwtUID     = "uid" // 用户标识
)

type Option func(j *Jwt)

func NewJwt(cfg *Config, opts ...Option) *Jwt {
	j := &Jwt{
		Cfg: cfg,
	}
	for _, opt := range opts {
		opt(j)
	}
	return j
}
func WithRedis(redis *redis.Client) Option {
	return func(j *Jwt) {
		j.redis = redis
	}
}

func WithCachePrefix(cachePrefix string) Option {
	return func(j *Jwt) {
		j.CachePrefix = cachePrefix
	}
}

type ContextWithValueKey string

func (j *Jwt) SetPayloadToContext(ctx context.Context, claims jwts.MapClaims) context.Context {
	for k, v := range claims {
		switch k {
		case JwtAudience, JwtExpired, JwtId, JwtIssueAt, JwtIssuer, JwtNotBefore, JwtSubject, JwtRefresh:
			// ignore the standard claims
		default:
			ctx = context.WithValue(ctx, ContextWithValueKey(k), v)
		}
	}
	return ctx
}

func (j *Jwt) GetPayloads(claims jwts.MapClaims) map[string]string {
	kv := make(map[string]string)
	if len(claims) > 0 {
		for k := range claims {
			switch k {
			case JwtAudience, JwtExpired, JwtId, JwtIssueAt, JwtIssuer, JwtNotBefore, JwtSubject, JwtRefresh:

			default:
				kv[k] = gconv.String(claims[k])
			}
		}
	}
	return kv
}

func (j *Jwt) GetUid(claims jwts.MapClaims) int64 {
	return gconv.Int64(claims[JwtUID])
}

// GenerateToken 生成token
func (j *Jwt) GenerateToken(payloads map[string]interface{}) (*Token, jwts.MapClaims, error) {
	token, claims, err := j.genToken(payloads)
	if err != nil {
		return nil, nil, err
	}
	if j.redis != nil {
		// token存入redis
		err = j.jwtTokenStore(claims)
		if err != nil {
			return nil, nil, err
		}
	}
	return token, claims, err
}

// CheckToken 检查token
func (j *Jwt) CheckToken(tokenString string) (jwts.MapClaims, error) {
	claims, err := j.parseToken(tokenString)
	if err != nil {
		return nil, err
	}
	if j.redis != nil {
		// token检测
		err = j.jwtTokenCheck(claims)
		if err != nil {
			return nil, err
		}
	}
	return claims, nil
}

// ExpiredToken 过期token
func (j *Jwt) ExpiredToken(jwtUID string) error {
	if j.redis == nil {
		return nil
	}
	cacheKey := j.buildCacheKey(jwtUID)
	err := j.redis.Del(context.Background(), cacheKey).Err()
	if err != nil {
		return TokenStoreErr
	}
	return nil
}

// genToken  生成token
func (j *Jwt) genToken(payloads map[string]interface{}) (*Token, jwts.MapClaims, error) {
	if payloads[JwtUID] == nil {
		return nil, nil, UIDNotRequest
	}
	now := time.Now()
	iat := now.Unix()
	expiredAt := iat + j.Cfg.AccessExpire
	refreshAt := iat + j.Cfg.RefreshAfter
	claims := make(jwts.MapClaims)
	claims[JwtId] = strconv.FormatInt(now.UnixNano(), 10)
	claims[JwtIssueAt] = iat
	claims[JwtIssuer] = j.Cfg.Issuer
	claims[JwtNotBefore] = iat - 1000
	claims[JwtExpired] = expiredAt
	claims[JwtRefresh] = refreshAt
	if len(payloads) > 0 {
		for k, v := range payloads {
			switch k {
			case JwtAudience, JwtExpired, JwtId, JwtIssueAt, JwtIssuer, JwtNotBefore, JwtSubject, JwtRefresh:
				// ignore the standard claims
			default:
				claims[k] = v
			}
		}
	}
	token := jwts.NewWithClaims(jwts.SigningMethodHS256, claims)
	signedString, err := token.SignedString([]byte(j.Cfg.AccessSecret))
	if err != nil {
		return nil, nil, err
	}
	return &Token{
		Token:     signedString,
		ExpiredAt: expiredAt,
		RefreshAt: refreshAt,
	}, claims, nil
}

func (j *Jwt) parseToken(tokenString string) (jwts.MapClaims, error) {
	token, err := jwts.Parse(tokenString, func(token *jwts.Token) (interface{}, error) {
		return []byte(j.Cfg.AccessSecret), nil
	})
	if err != nil {
		var e *jwts.ValidationError
		switch {
		case errors.As(err, &e):
			switch e.Errors {
			case jwts.ValidationErrorExpired: // 过期
				return nil, TokenExpired
			default:
				return nil, errors.Wrap(TokenInvalid, "not jwt ValidationErrorExpired")
			}
		default:
			return nil, errors.Wrap(TokenInvalid, "not jwt ValidationError")
		}
	}
	if token == nil {
		return nil, errors.Wrap(TokenInvalid, "token is nil")
	}
	claims := token.Claims.(jwts.MapClaims)
	if _, ok := claims[JwtId]; !ok {
		return nil, errors.Wrap(TokenInvalid, "not set JwtId")
	}
	if _, ok := claims[JwtIssueAt]; !ok {
		return nil, errors.Wrap(TokenInvalid, "not set JwtIssueAt")
	}
	if _, ok := claims[JwtExpired]; !ok {
		return nil, errors.Wrap(TokenInvalid, "not set JwtExpired")
	}
	if _, ok := claims[JwtRefresh]; !ok {
		return nil, errors.Wrap(TokenInvalid, "not set JwtRefresh")
	}
	return claims, nil
}

// 要做单一登录 即保存当前
func (j *Jwt) buildCacheKey(jwtUID string) string {
	return strings.Trim(j.CachePrefix+":"+"jwt:"+j.Cfg.Issuer+":"+jwtUID, ":")
}

// JwtTokenStore 要做单一登录 即保存当前jwt的编号
func (j *Jwt) jwtTokenStore(claims jwts.MapClaims) error {
	if j.redis == nil {
		return nil
	}
	cacheKey := j.buildCacheKey(gconv.String(claims[JwtUID]))
	refreshTime := time.Unix(gconv.Int64(claims[JwtRefresh]), 0)
	expiresAt := time.Until(refreshTime)
	err := j.redis.Set(context.Background(), cacheKey, gconv.String(claims[JwtId]), expiresAt).Err()
	if err != nil {
		return TokenStoreErr
	}
	return nil
}

// JwtTokenCheck Token检测
func (j *Jwt) jwtTokenCheck(claims jwts.MapClaims) error {
	if j.redis == nil {
		return nil
	}
	cacheKey := j.buildCacheKey(gconv.String(claims[JwtUID]))
	result, err := j.redis.Get(context.Background(), cacheKey).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return TokenStoreErr
	}
	if result == "" {
		return TokenGetErr
	}
	jwtId := gconv.Int64(claims[JwtId])
	if result != strconv.Itoa(int(jwtId)) {
		return TokenCheckErr
	}
	return nil
}
