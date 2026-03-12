CREATE TABLE public."user" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ph character varying(255),
    "userWxId" character varying(64) NOT NULL,
    nickname character varying(500),
    avatar character varying(1000),
    status smallint DEFAULT 1 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public."user" IS '用户';
COMMENT ON COLUMN public."user".id IS 'id';
COMMENT ON COLUMN public."user".ph IS '手机号(加密)';
COMMENT ON COLUMN public."user"."userWxId" IS '用户微信ID';
COMMENT ON COLUMN public."user".nickname IS '昵称';
COMMENT ON COLUMN public."user".avatar IS '头像';
COMMENT ON COLUMN public."user".status IS '-1=禁用 1=开启';
COMMENT ON COLUMN public."user"."createdAt" IS '创建时间';
COMMENT ON COLUMN public."user"."updatedAt" IS '更新时间';
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX user_ph_idx ON public."user" USING btree (ph);
CREATE UNIQUE INDEX "user_userWxId_idx" ON public."user" USING btree ("userWxId");
