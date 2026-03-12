CREATE TABLE public.course (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "courseName" character varying(255) NOT NULL,
    "mainImage" jsonb,
    "detailImages" jsonb,
    price real,
    status character varying(16) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public.course IS '课程-信息';
COMMENT ON COLUMN public.course.id IS 'id';
COMMENT ON COLUMN public.course."courseName" IS '课程名称';
COMMENT ON COLUMN public.course."mainImage" IS '主图(多张)';
COMMENT ON COLUMN public.course."detailImages" IS '详情图(多张)';
COMMENT ON COLUMN public.course.price IS '价格';
COMMENT ON COLUMN public.course.status IS '状态';
COMMENT ON COLUMN public.course."createdAt" IS '开始时间';
COMMENT ON COLUMN public.course."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.course."updatedBy" IS '更新人';
ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);
