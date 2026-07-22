package data

import (
	"context"
	"fmt"
	"time"

	"github.com/dtm-labs/rockscache"
	"github.com/go-kratos/kratos/contrib/registry/nacos/v2"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/registry"
	goRedis "github.com/go-redis/redis/v8"
	"github.com/go-resty/resty/v2"
	"github.com/google/wire"
	"github.com/nacos-group/nacos-sdk-go/clients"
	"github.com/nacos-group/nacos-sdk-go/clients/config_client"
	"github.com/nacos-group/nacos-sdk-go/clients/naming_client"
	"github.com/nacos-group/nacos-sdk-go/common/constant"
	"github.com/nacos-group/nacos-sdk-go/vo"
	"github.com/pkg/errors"
	"github.com/spf13/cast"
	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/goresty"
	"gitlab.yc345.tv/backend/orm-gen/v2/cache"
	"gitlab.yc345.tv/backend/orm-gen/v2/cache/rocksdbcache"
	"gitlab.yc345.tv/backend/orm-gen/v2/config"
	"gitlab.yc345.tv/backend/orm-gen/v2/encoding"
	"gitlab.yc345.tv/backend/utils/v2/client/redis"
	"gitlab.yc345.tv/backend/utils/v2/health/core"
	"gitlab.yc345.tv/backend/utils/v2/mq"
	"gitlab.yc345.tv/backend/utils/v2/mq/kafka"
	mqMiddleware "gitlab.yc345.tv/backend/utils/v2/mq/middleware"
	"gitlab.yc345.tv/backend/utils/v2/orm"
	"gitlab.yc345.tv/backend/utils/v2/rabbitmq"
	"gopkg.in/natefinch/lumberjack.v2"
	"gorm.io/gorm"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(
	NewNacosNamingClient,
	NewNacosConfig,
	NewNacosRegistrar,
	NewNacosDiscovery,
	NewDB,
	NewRedis,
	NewRocksCacheClient,
	NewDBCache,
	NewDBRepoConfig,
	NewRabbitMq,
	NewData,
	goresty.NewResty,
	NewCommonRepo,
	NewDynamicDockConfigRepo,
	NewDynamicDockConfigV2Repo,
	NewDynamicFunctionConfigRepo,
	NewDynamicLearnConfigRepo,
	NewHomeworkAssistantCorrectionRecordRepo,
	NewHomeworkAssistantRecordRepo,
	NewHomeworkAssistantRectificationRecordRepo,
	NewHomeworkAssistantScoreRepo,
	NewHomeworkAssistantUserStudyStatisticRepo,
	NewLearnConfigRepo,
	NewNpRepo,
	NewNpsGoLearnSceneNumRepo,
	NewNpsSummaryRepo,
	NewUserLearnStyleRepo,
	NewUserLearnTargetRepo,
	devices_learn_repo.NewDynamicDockConfigRepo,
	devices_learn_repo.NewDynamicDockConfigV2Repo,
	devices_learn_repo.NewDynamicFunctionConfigRepo,
	devices_learn_repo.NewDynamicLearnConfigRepo,
	devices_learn_repo.NewHomeworkAssistantCorrectionRecordRepo,
	devices_learn_repo.NewHomeworkAssistantRecordRepo,
	devices_learn_repo.NewHomeworkAssistantRectificationRecordRepo,
	devices_learn_repo.NewHomeworkAssistantScoreRepo,
	devices_learn_repo.NewHomeworkAssistantUserStudyStatisticRepo,
	devices_learn_repo.NewLearnConfigRepo,
	devices_learn_repo.NewNpRepo,
	devices_learn_repo.NewNpsGoLearnSceneNumRepo,
	devices_learn_repo.NewNpsSummaryRepo,
	devices_learn_repo.NewUserLearnStyleRepo,
	devices_learn_repo.NewUserLearnTargetRepo,
)

type Data struct {
	db            *gorm.DB
	goRedisClient *goRedis.Client
	rocksCache    *rockscache.Client
	dbCache       cache.IDBCache
	restyClient   *resty.Client
	rr            *rabbitmq.Rabbitmq
}

func NewData(
	db *gorm.DB,
	dbCache cache.IDBCache,
	goRedisClient *goRedis.Client,
	rocksCache *rockscache.Client,
	restyClient *resty.Client,
	rr *rabbitmq.Rabbitmq,
) *Data {
	return &Data{
		db:            db,
		goRedisClient: goRedisClient,
		rocksCache:    rocksCache,
		dbCache:       dbCache,
		restyClient:   restyClient,
		rr:            rr,
	}
}

// NewDB 启动DB
func NewDB(cfg *conf.Bootstrap, logger log.Logger) (*gorm.DB, error) {
	c := cfg.Yc.Pg[cfg.Name]
	l := log.NewHelper(log.With(logger, "module", "NewDB"), log.WithMessageKey("message"))
	ORMConfig := &orm.ORMConfig{
		User:            c.User,
		Password:        c.Password,
		Host:            c.Host,
		Port:            c.Port,
		DBname:          c.Db,
		MaxIdleConns:    cast.ToInt(c.MaxIdleConns),
		MaxOpenConns:    cast.ToInt(c.MaxOpenConns),
		ConnMaxLifeTime: cast.ToDuration(c.ConnMaxLifetime),
	}
	if c.Debug {
		ORMConfig.LogMode = orm.LogModeInfo
	}
	client, err := orm.NewDBWithStruct(ORMConfig)
	if err != nil {
		l.Fatalf("failed opening connection to db")
		panic(fmt.Sprintf("NewDB err: %s", err))
	}
	// 健康检查组建注册
	core.Manager.RegistComponent(context.Background(), client.Client.Name(), client.GetHealthStatus)
	// 注册 gorm metrics
	orm.MustRegisterMetrics(client.Client, orm.WithDBName(c.Name))
	// 链接日志记录
	log.Infof("gorm start success %+v %s", client.GetState(), client.GetHealthStatus(context.Background()))
	return client.Client, nil
}

// NewRedis 启动并初始化redis
func NewRedis(cfg *conf.Bootstrap) (*goRedis.Client, error) {
	c := cfg.Yc.Redis[cfg.Name]
	client := redis.NewClient(&redis.Config{
		Addr:         c.Addr,
		Username:     c.Username,
		Password:     c.Password,
		DB:           int(c.Db),
		ReadTimeout:  time.Duration(c.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(c.WriteTimeout) * time.Second,
		KeyPrefix:    c.KeyPrefix,
		MaxLatency:   time.Duration(c.MaxLatency) * time.Second,
		PoolFIFO:     c.PoolFIFO,
		PoolSize:     int(c.PoolSize),
		PoolTimeout:  time.Duration(c.PoolTimeout) * time.Second,
		MinIdleConns: int(c.MinIdleConns),
		IdleTimeout:  time.Duration(c.IdleTimeout) * time.Second,
		MaxConnAge:   time.Duration(c.MaxConnAge) * time.Second,
	})
	// 健康检查组建注册
	core.Manager.RegistComponent(context.Background(), c.Name, client.GetHealthStatus)
	// 注册redis metrics
	redis.MustRegisterMetrics(client.Instance(), redis.WithDBName(c.Name))
	return client.Instance(), nil
}

// NewDBCache DB缓存
func NewDBCache(cfg *conf.Bootstrap, rdb *goRedis.Client, rocksCache *rockscache.Client) cache.IDBCache {
	return rocksdbcache.NewRocksDBCache(rdb, rocksCache, rocksdbcache.WithName(cfg.GetName()))
}

// NewDBRepoConfig DB repo配置
func NewDBRepoConfig(db *gorm.DB, dbCache cache.IDBCache) *config.Repo {
	return config.NewRepoConfig(db, dbCache, encoding.NewMsgPack())
}

// NewRocksCacheClient //弱一致性RocksCache缓存客户端
func NewRocksCacheClient(rdb *goRedis.Client) *rockscache.Client {
	rc := rockscache.NewClient(rdb, rockscache.NewDefaultOptions())
	// 常用参数设置
	// 1、强一致性(默认关闭强一致性，如果开启的话会影响性能)
	rc.Options.StrongConsistency = false
	// 2、redis出现问题需要缓存降级时设置为true
	rc.Options.DisableCacheRead = false   // 关闭缓存读，默认false；如果打开，那么Fetch就不从缓存读取数据，而是直接调用fn获取数据
	rc.Options.DisableCacheDelete = false // 关闭缓存删除，默认false；如果打开，那么TagAsDeleted就什么操作都不做，直接返回
	// 3、其他设置
	// 标记删除的延迟时间，默认10秒，设置为1纳秒表示：被删除的key在1纳秒后才从redis中彻底清除
	rc.Options.Delay = time.Nanosecond * time.Duration(1)
	// 防穿透：若fn返回空字符串，空结果在缓存中的缓存时间，默认60秒
	rc.Options.EmptyExpire = time.Second * time.Duration(120)
	// 防雪崩,默认0.1,当前设置为0.1的话，如果设定为600的过期时间，那么过期时间会被设定为540s - 600s中间的一个随机数，避免数据出现同时到期
	rc.Options.RandomExpireAdjustment = 0.1 // 设置为默认就行
	return rc
}

// NewRabbitMq 初始化Rabbitmq
func NewRabbitMq(cfg *conf.Bootstrap) (*rabbitmq.Rabbitmq, error) {
	c := cfg.Yc.Rabbitmq[cfg.Name]
	client, _, err := rabbitmq.NewRabbitmq(&rabbitmq.AMQPConnectConfig{
		VHost:    c.Vhost,
		UserName: c.UserName,
		Password: c.Password,
		EndPoint: c.EndPoint,
	}, &rabbitmq.ReconnectConfig{
		ReconnectLimit:   int(c.ReconnectLimit),
		ReconnectTimeGap: time.Duration(int(c.ReconnectTimeGap)),
	})
	if err != nil {
		err = errors.New("NewRabbitMq:" + err.Error())
		panic(err)
	}
	if len(c.Business) > 0 {
		for _, business := range c.Business {
			if !business.Enable {
				continue
			}
			_, err := client.UseOrCreateProducer(&rabbitmq.ProducerConfig{
				ExchangeName: business.ExchangeName,
			})
			if err != nil {
				return nil, err
			}
		}
	}
	return client, nil
}

// Producer 生产者
type Producer struct {
	User mq.Producer
}

// NewMQClient 初始化生产客户端
func NewMQClient(cfg *conf.Bootstrap) (*Producer, error) {
	result := &Producer{}
	// 1. 构建客户端.
	user, err := kafka.NewWithJSON(cfg.GetYc().GetKafka().GetUser())
	if err != nil {
		return nil, err
	}
	// 2. 增加中间件
	user.AddProducerMiddleware(
		mqMiddleware.Logger(mq.MQ_TYPE_KAFKA, mq.OPERATION_PUBLISH, cfg.GetYc().GetKafka().GetUser().GetTopic()),
		mqMiddleware.Recovery(),
	)
	// 3. 实例化生产者
	result.User, err = user.NewProducer()
	if err != nil {
		return nil, err
	}
	return result, nil
}

// NewNacosNamingClient 服务发现客户端
func NewNacosNamingClient(cfg *conf.Bootstrap) (naming_client.INamingClient, error) {
	c := cfg.Yc.Nacos
	sc := []constant.ServerConfig{
		*constant.NewServerConfig(c.Host, c.Port),
	}
	cc := constant.ClientConfig{
		Username:            c.Username,
		Password:            c.Password,
		NotLoadCacheAtStart: true,
		LogLevel:            `error`,
		LogRollingConfig:    &lumberjack.Logger{MaxSize: 10},
	}
	client, err := clients.NewNamingClient(
		vo.NacosClientParam{
			ServerConfigs: sc,
			ClientConfig:  &cc,
		},
	)
	return client, err
}

// NewNacosRegistrar 注册中心客户端
func NewNacosRegistrar(client naming_client.INamingClient) registry.Registrar {
	return nacos.New(client)
}

// NewNacosDiscovery 服务发现客户端
func NewNacosDiscovery(client naming_client.INamingClient) registry.Discovery {
	return nacos.New(client)
}

// NewNacosConfig 配置中心客户端
func NewNacosConfig(cfg *conf.Bootstrap) (config_client.IConfigClient, error) {
	c := cfg.Yc.Nacos
	sc := []constant.ServerConfig{
		*constant.NewServerConfig(c.Host, c.Port),
	}
	cc := constant.ClientConfig{
		NamespaceId:         "public", // namespace id
		Username:            c.Username,
		Password:            c.Password,
		NotLoadCacheAtStart: true,
		LogLevel:            `error`,
		LogRollingConfig:    &lumberjack.Logger{MaxSize: 10},
	}
	// a more graceful way to create naming client
	client, err := clients.NewConfigClient(
		vo.NacosClientParam{
			ClientConfig:  &cc,
			ServerConfigs: sc,
		},
	)
	if err != nil {
		return nil, err
	}
	conf.Kconf = client
	return client, err
}
