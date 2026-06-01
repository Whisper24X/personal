package biz

import (
	"context"
	"sort"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserBindStudentList 用户绑定学生-列表数据查询
func (w *WechatV1UserBindStudentUseCase) GetUserBindStudentList(ctx context.Context, req *pb.GetUserBindStudentListReq) (*pb.GetUserBindStudentListReply, error) {
	resp := &pb.GetUserBindStudentListReply{
		List: []*pb.UserBindStudentInfo{},
	}
	userId := meta.GetUserID(ctx)
	list, err := w.userBindStudentRepo.FindMultiCacheByUserID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 更新时间倒序
	sort.Slice(list, func(i, j int) bool {
		return list[i].UpdatedAt.After(list[j].UpdatedAt)
	})
	for _, v := range list {
		studentIdentityCard := ""
		if v.StudentIC != "" {
			studentIdentityCard, err = cryptutil.YcCardDecrypt(v.StudentIC)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
		}
		resp.List = append(resp.List, &pb.UserBindStudentInfo{
			Id:                  v.ID,
			StudentIdentityCard: studentIdentityCard,
			StudentName:         v.StudentName,
			StudentSex:          v.StudentSex,
			StudentAge:          int32(v.StudentAge),
			CreatedAt:           timeutil.RFC3339(v.CreatedAt),
			UpdatedAt:           timeutil.RFC3339(v.UpdatedAt),
		})
	}
	return resp, nil
}
