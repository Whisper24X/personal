package cache

import (
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/util/compressutil"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/util/msgpackutil"
)

// Marshal 编码
func Marshal(v any) ([]byte, error) {
	marshal, err := msgpackutil.Marshal(v)
	if err != nil {
		return nil, err
	}
	return compressutil.ZlibCompress(marshal)
}

// Unmarshal 解码
func Unmarshal(bts []byte, ptr any) error {
	compress, err := compressutil.ZlibUnCompress(bts)
	if err != nil {
		return err
	}
	return msgpackutil.Unmarshal(compress, ptr)
}

// MarshalString 编码到字符串
func MarshalString(v any) (string, error) {
	marshal, err := msgpackutil.Marshal(v)
	if err != nil {
		return "", err
	}
	compress, err := compressutil.ZlibCompress(marshal)
	if err != nil {
		return "", err
	}
	return string(compress), nil
}

// UnmarshalString 解码字符串
func UnmarshalString(str string, ptr any) error {
	compress, err := compressutil.ZlibUnCompress([]byte(str))
	if err != nil {
		return err
	}
	return msgpackutil.Unmarshal(compress, ptr)
}
