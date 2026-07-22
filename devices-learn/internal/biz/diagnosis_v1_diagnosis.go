package biz

import "github.com/go-kratos/kratos/v2/log"

func NewDiagnosisV1DiagnosisUseCase(
	logger log.Logger,
) *DiagnosisV1DiagnosisUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/diagnosisV1Diagnosis"), log.WithMessageKey("message"))
	return &DiagnosisV1DiagnosisUseCase{
		log: l,
	}
}

type DiagnosisV1DiagnosisUseCase struct {
	log *log.Helper
}
