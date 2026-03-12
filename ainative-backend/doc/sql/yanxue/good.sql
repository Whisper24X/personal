CREATE TABLE public.good (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "platformGoodId" character varying(128) NOT NULL,
    "channelId" character varying(128) NOT NULL,
    "channelGoodId" character varying(128) NOT NULL,
    name character varying(255) NOT NULL,
    "mainImage" jsonb NOT NULL,
    "detailImages" jsonb NOT NULL,
    price double precision NOT NULL,
    content jsonb,
    "appointmentRules" text NOT NULL,
    status character varying(16) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public.good IS '渠道商品表';
COMMENT ON COLUMN public.good.id IS 'id';
COMMENT ON COLUMN public.good."platformGoodId" IS '平台商品Id';
COMMENT ON COLUMN public.good."channelId" IS '渠道Id';
COMMENT ON COLUMN public.good."channelGoodId" IS '渠道商品Id';
COMMENT ON COLUMN public.good.name IS '名称';
COMMENT ON COLUMN public.good."mainImage" IS '主图(多张)';
COMMENT ON COLUMN public.good."detailImages" IS '详情图(多张)';
COMMENT ON COLUMN public.good.price IS '价格';
COMMENT ON COLUMN public.good.content IS '内容';
COMMENT ON COLUMN public.good."appointmentRules" IS '预约规则';
COMMENT ON COLUMN public.good.status IS '状态';
COMMENT ON COLUMN public.good."createdAt" IS '开始时间';
COMMENT ON COLUMN public.good."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.good."updatedBy" IS '操作人';
ALTER TABLE ONLY public.good
    ADD CONSTRAINT good_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX "good_channelGoodId_idx" ON public.good USING btree ("channelGoodId");
CREATE INDEX "good_platformGoodId_idx" ON public.good USING btree ("platformGoodId");
