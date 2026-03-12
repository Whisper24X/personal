CREATE TABLE public.course_stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "courseId" character varying(64) NOT NULL,
    date character varying(32) NOT NULL,
    period character varying(64) NOT NULL,
    stock integer NOT NULL,
    status character varying(16) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public.course_stock IS '课程-库存';
COMMENT ON COLUMN public.course_stock.id IS 'id';
COMMENT ON COLUMN public.course_stock."courseId" IS '课程Id';
COMMENT ON COLUMN public.course_stock.date IS '课程日期';
COMMENT ON COLUMN public.course_stock.period IS '课程时间';
COMMENT ON COLUMN public.course_stock.stock IS '库存';
COMMENT ON COLUMN public.course_stock.status IS '状态';
COMMENT ON COLUMN public.course_stock."createdAt" IS '开始时间';
COMMENT ON COLUMN public.course_stock."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.course_stock."updatedBy" IS '更新人';
ALTER TABLE ONLY public.course_stock
    ADD CONSTRAINT course_stock_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX "course_stock_courseId_date_period_idx" ON public.course_stock USING btree ("courseId", date, period);
