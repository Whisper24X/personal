CREATE TABLE public.platform_good (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public.platform_good IS '平台商品表';
COMMENT ON COLUMN public.platform_good.id IS 'id';
COMMENT ON COLUMN public.platform_good.name IS '名称';
COMMENT ON COLUMN public.platform_good."createdAt" IS '创建时间';
COMMENT ON COLUMN public.platform_good."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.platform_good."updatedBy" IS '操作人';
ALTER TABLE ONLY public.platform_good
    ADD CONSTRAINT platform_good_pkey PRIMARY KEY (id);
CREATE INDEX idx_platform_good_name ON public.platform_good USING btree (name);
