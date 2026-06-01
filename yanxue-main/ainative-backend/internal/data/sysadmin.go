package data

import (
	"context"
	"errors"

	"github.com/go-kratos/kratos/v2/log"
	jwts "github.com/golang-jwt/jwt"
	"github.com/google/uuid"
	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/jwt"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.SysAdminRepo = (*SysAdminRepo)(nil)

func NewSysAdminRepo(
	logger log.Logger,
	config *conf.Bootstrap,
	data *Data,
	sysAdminRepo *yanxue_repo.SysAdminRepo,
) biz.SysAdminRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysAdmin"), log.WithMessageKey("message"))
	cfg, ok := config.Jwt["admin"]
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
	return &SysAdminRepo{
		log:          l,
		config:       config,
		data:         data,
		jwt:          j,
		SysAdminRepo: sysAdminRepo,
	}
}

type SysAdminRepo struct {
	log    *log.Helper
	config *conf.Bootstrap
	data   *Data
	jwt    *jwt.Jwt
	*yanxue_repo.SysAdminRepo
}

// DTO 数据转换
func (s *SysAdminRepo) DTO(sysAdmin *yanxue_model.SysAdmin) (*pb.SysAdminInfo, error) {
	phone, err := cryptutil.YcPhoneDecrypt(sysAdmin.Ph)
	if err != nil {
		return nil, errorx.DataEncryptErr.WithError(err).Err()
	}
	return &pb.SysAdminInfo{
		Id:          sysAdmin.ID,
		Phone:       phone,
		Nickname:    sysAdmin.Nickname,
		Avatar:      sysAdmin.Avatar,
		Status:      int32(sysAdmin.Status),
		IsChangePwd: sysAdmin.IsChangePwd,
		CreatedAt:   timeutil.RFC3339(sysAdmin.CreatedAt),
		UpdatedAt:   timeutil.RFC3339(sysAdmin.UpdatedAt),
		RoleList:    []*pb.SysAdminRoleInfo{},
		DeptList:    []*pb.SysAdminDeptInfo{},
	}, nil
}

// GenerateJwTToken 生成jwt
func (s *SysAdminRepo) GenerateJwTToken(ctx context.Context, kv map[string]interface{}) (*jwt.Token, error) {
	token, _, err := s.jwt.GenerateToken(kv)
	if err != nil {
		return nil, errorx.TokenGenerationFailed.WithError(err).Err()
	}
	return token, nil
}

// CheckJwtTokenCheck jwt校验,并返回adminId
func (s *SysAdminRepo) CheckJwtTokenCheck(ctx context.Context, token string) (jwts.MapClaims, error) {
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
func (s *SysAdminRepo) ExpiredToken(ctx context.Context, adminIds []string) error {
	for _, adminId := range adminIds {
		err := s.jwt.ExpiredToken(adminId)
		if err != nil {
			return err
		}
	}
	return nil
}

// AdminIdToName 管理员id转名称
func (s *SysAdminRepo) AdminIdToName(ctx context.Context, adminIds []string) (map[string]string, error) {
	adminIds = lo.Uniq(adminIds)
	adminIds = lo.Filter(adminIds, func(item string, _ int) bool {
		return item != "" && uuid.Validate(item) == nil
	})
	if len(adminIds) == 0 {
		return map[string]string{}, nil
	}
	adminMap := make(map[string]string)
	admin, err := s.FindMultiCacheByIDS(ctx, adminIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, admin := range admin {
		adminMap[admin.ID] = admin.Nickname
	}
	return adminMap, nil
}
