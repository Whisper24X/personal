CREATE TABLE public.channel (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    "verificationCodeType" character varying(64),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.channel IS '渠道表';
COMMENT ON COLUMN public.channel.id IS 'id';
COMMENT ON COLUMN public.channel.name IS '渠道名称';
COMMENT ON COLUMN public.channel."verificationCodeType" IS '渠道卷码类型none:无卷码required:必须optional:可有可无';
COMMENT ON COLUMN public.channel."createdAt" IS '创建时间';
COMMENT ON COLUMN public.channel."updatedAt" IS '更新时间';
ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_pkey PRIMARY KEY (id);
