CREATE TABLE public.course_appointment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "orderId" character varying(64) NOT NULL,
    "goodId" character varying(64),
    "categoryId" character varying(64),
    "courseId" character varying(64) NOT NULL,
    date character varying(32) NOT NULL,
    period character varying(64) NOT NULL,
    "periodStartTime" character varying(64),
    "periodEndTime" character varying(64),
    "studentName" character varying(255) NOT NULL,
    "studentIC" character varying(500) NOT NULL,
    "studentAge" smallint,
    "studentSex" character varying(2) NOT NULL,
    "parentName" character varying(64) NOT NULL,
    "parentPh" character varying(255) NOT NULL,
    "parentAccompany" character varying(32) NOT NULL,
    "verificationCode" character varying(255),
    status character varying(16) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public.course_appointment IS '课程-预约';
COMMENT ON COLUMN public.course_appointment.id IS 'id';
COMMENT ON COLUMN public.course_appointment."orderId" IS '订单id';
COMMENT ON COLUMN public.course_appointment."goodId" IS '商品Id';
COMMENT ON COLUMN public.course_appointment."categoryId" IS '商品分类id';
COMMENT ON COLUMN public.course_appointment."courseId" IS '课程id';
COMMENT ON COLUMN public.course_appointment.date IS '课程日期';
COMMENT ON COLUMN public.course_appointment.period IS '课程时间';
COMMENT ON COLUMN public.course_appointment."periodStartTime" IS '课程开始时间';
COMMENT ON COLUMN public.course_appointment."periodEndTime" IS '课程结束时间';
COMMENT ON COLUMN public.course_appointment."studentName" IS '学生-名称';
COMMENT ON COLUMN public.course_appointment."studentIC" IS '学生-身份证(加密)';
COMMENT ON COLUMN public.course_appointment."studentAge" IS '学生-年龄';
COMMENT ON COLUMN public.course_appointment."studentSex" IS '学生-性别(男M,女F)';
COMMENT ON COLUMN public.course_appointment."parentName" IS '家长-姓名';
COMMENT ON COLUMN public.course_appointment."parentPh" IS '家长-手机号(加密)';
COMMENT ON COLUMN public.course_appointment."parentAccompany" IS '家长-是否陪同';
COMMENT ON COLUMN public.course_appointment."verificationCode" IS '核销卷码';
COMMENT ON COLUMN public.course_appointment.status IS '状态';
COMMENT ON COLUMN public.course_appointment."createdAt" IS '创建时间';
COMMENT ON COLUMN public.course_appointment."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.course_appointment."updatedBy" IS '更新人';
ALTER TABLE ONLY public.course_appointment
    ADD CONSTRAINT course_appointment_pkey PRIMARY KEY (id);
CREATE INDEX "course_appointment_courseId_date_period_idx" ON public.course_appointment USING btree ("courseId", date, period);
CREATE INDEX "course_appointment_orderId_idx" ON public.course_appointment USING btree ("orderId");
