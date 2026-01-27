CREATE TABLE public.user_bind_student (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying(64) NOT NULL,
    "studentName" character varying(255) NOT NULL,
    "studentIC" character varying(500) NOT NULL,
    "studentSex" character varying(2) NOT NULL,
    "studentAge" smallint NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.user_bind_student IS '用户绑定学生';
COMMENT ON COLUMN public.user_bind_student.id IS 'id';
COMMENT ON COLUMN public.user_bind_student."userId" IS '用户ID';
COMMENT ON COLUMN public.user_bind_student."studentName" IS '学生-名称';
COMMENT ON COLUMN public.user_bind_student."studentIC" IS '学生-身份证（加密）';
COMMENT ON COLUMN public.user_bind_student."studentSex" IS '学生-性别(男M,女F)';
COMMENT ON COLUMN public.user_bind_student."studentAge" IS '学生-年龄';
COMMENT ON COLUMN public.user_bind_student."createdAt" IS '创建时间';
COMMENT ON COLUMN public.user_bind_student."updatedAt" IS '更新时间';
ALTER TABLE ONLY public.user_bind_student
    ADD CONSTRAINT user_bind_student_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX "user_bind_student_userId_studentIC_idx" ON public.user_bind_student USING btree ("userId", "studentIC");
