CREATE TABLE public.user_wx (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    unionid character varying(64) NOT NULL,
    "offiaccountOpenId" character varying(64),
    "offiaccountFollow" boolean,
    status smallint DEFAULT 1 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.user_wx IS '用户-微信';
COMMENT ON COLUMN public.user_wx.id IS 'id';
COMMENT ON COLUMN public.user_wx.unionid IS 'unionid';
COMMENT ON COLUMN public.user_wx."offiaccountOpenId" IS '公众号openid';
COMMENT ON COLUMN public.user_wx."offiaccountFollow" IS '公众号是否关注';
COMMENT ON COLUMN public.user_wx.status IS '-1=禁用 1=开启';
COMMENT ON COLUMN public.user_wx."createdAt" IS '创建时间';
COMMENT ON COLUMN public.user_wx."updatedAt" IS '更新时间';
ALTER TABLE ONLY public.user_wx
    ADD CONSTRAINT user_wx_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX "user_wx_offiaccountOpenId_idx" ON public.user_wx USING btree ("offiaccountOpenId");
