package conf

import (
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/nacos-group/nacos-sdk-go/clients/config_client"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

var config = &Config{Viper: viper.New()}
var Kconf config_client.IConfigClient
var _logger = logrus.New()

var defaultGoEnv = "production"

type Config struct {
	init sync.Once
	*viper.Viper
}

// StartConfig GetGoEnv 查询golang运行环境,默认生产.
func StartConfig(configAddr string) error {
	if configAddr == "" {
		configAddr = "../../configs"
	}
	err := NewConfig(configAddr)
	return err
}

// GetGoEnv 查询golang运行环境,默认生产.
func GetGoEnv() string {
	goEnv := os.Getenv("GO_ENV")
	if goEnv == "" {
		goEnv = defaultGoEnv
	}
	return goEnv
}

func (c *Config) UnmarshalKey(k string, result interface{}) error {
	k = strings.ToLower(k)
	return c.Viper.UnmarshalKey(k, result)
}

func (c *Config) Get(k string) interface{} {
	k = strings.ToLower(k)
	return c.Viper.Get(k)
}

// NewConfig path 文件夹地址.
func NewConfig(path string) (err error) {
	config.init.Do(func() {
		_logger.SetFormatter(&logrus.JSONFormatter{})

		config.SetConfigType("yaml")
		_ = config.BindEnv("GO_ENV")
		absolutePath, err1 := filepath.Abs(path)
		if err1 != nil {
			_logger.Errorf("conf get folder absolutePath err %s", err1)
		}
		config.AddConfigPath(absolutePath)
		// 读取默认配置文件
		config.SetConfigName("default")
		if err1 := config.ReadInConfig(); err1 != nil || len(config.AllKeys()) == 0 {
			_logger.Errorf("Fatal errs conf file: %s", err1)
		}

		// 读取环境变量的配置文件
		config.SetConfigName(GetGoEnv())
		if err1 := config.MergeInConfig(); err1 != nil || len(config.AllKeys()) == 0 {
			_logger.Panicf("GoEnv Fatal errs conf file: %s", err1)
		}

		// 监听配置文件变化
		config.WatchConfig()
		config.OnConfigChange(func(e fsnotify.Event) {
			_logger.Info("Config file changed: ", e.Name)
		})
	})

	return err
}

// Detail 查询配置文件详情.
func Detail() *Config {
	return config
}
