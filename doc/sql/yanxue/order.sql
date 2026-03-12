CREATE TABLE public."order" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "channelId" character varying(255) NOT NULL,
    "goodId" character varying(255) NOT NULL,
    "channelGoodId" character varying(128) NOT NULL,
    "orderNumber" character varying(255) NOT NULL,
    "orderPrice" real NOT NULL,
    "paymentTime" timestamp with time zone NOT NULL,
    ph character varying(500) NOT NULL,
    status character varying(16) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public."order" IS '订单';
COMMENT ON COLUMN public."order".id IS 'id';
COMMENT ON COLUMN public."order"."channelId" IS '渠道Id';
COMMENT ON COLUMN public."order"."goodId" IS '商品Id';
COMMENT ON COLUMN public."order"."channelGoodId" IS '渠道商品Id';
COMMENT ON COLUMN public."order"."orderNumber" IS '订单编号';
COMMENT ON COLUMN public."order"."orderPrice" IS '订单金额';
COMMENT ON COLUMN public."order"."paymentTime" IS '支付时间';
COMMENT ON COLUMN public."order".ph IS '联系电话';
COMMENT ON COLUMN public."order".status IS '订单状态';
COMMENT ON COLUMN public."order"."createdAt" IS '开始时间';
COMMENT ON COLUMN public."order"."updatedAt" IS '更新时间';
COMMENT ON COLUMN public."order"."updatedBy" IS '更新人';
ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_pkey PRIMARY KEY (id);
CREATE INDEX "order_goodId_idx" ON public."order" USING btree ("goodId");
CREATE UNIQUE INDEX "order_orderNumber_idx" ON public."order" USING btree ("orderNumber");
CREATE INDEX order_ph_idx ON public."order" USING btree (ph);
