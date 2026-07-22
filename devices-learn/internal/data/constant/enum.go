package constant

//go install github.com/abice/go-enum@latest

//go:generate go-enum --marshal --names --values --ptr --nocomments --flag --output-suffix .gen

// Status 常状态 ENUM(delete=-1,disable=0,enable=1)
type Status int32

// DeviceStatus 设备状态 ENUM(detached, normal)
type DeviceStatus string

// DeviceStatusActive 设备在线状态 ENUM(line_on, line_off)
type DeviceStatusActive string
