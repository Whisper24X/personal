package main

import "gitlab.yc345.tv/backend/yanxue/internal/data/errorx"

func main() {
	errorx.Manager.Export("doc/errcode")
}
