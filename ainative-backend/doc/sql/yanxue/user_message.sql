CREATE TABLE public.user_message (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying(64) NOT NULL,
    category character varying(32) NOT NULL,
    type character varying(32) NOT NULL,
    data jsonb,
    status smallint DEFAULT 1 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.user_message IS '用户-消息';
COMMENT ON COLUMN public.user_message.id IS 'id';
COMMENT ON COLUMN public.user_message."userId" IS '用户ID';
COMMENT ON COLUMN public.user_message.category IS '类别';
COMMENT ON COLUMN public.user_message.type IS '类型';
COMMENT ON COLUMN public.user_message.data IS '内容';
COMMENT ON COLUMN public.user_message.status IS '状态';
COMMENT ON COLUMN public.user_message."createdAt" IS '创建时间';
ALTER TABLE ONLY public.user_message
    ADD CONSTRAINT user_message_pkey PRIMARY KEY (id);
CREATE INDEX "user_message_xcxUserId_idx" ON public.user_message USING btree ("userId");
