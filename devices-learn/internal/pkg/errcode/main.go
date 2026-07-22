package main

import "gitlab.yc345.tv/backend/devices-learn/internal/data/errorx"

func main() {
	errorx.Manager.Export("doc/errcode")
}
