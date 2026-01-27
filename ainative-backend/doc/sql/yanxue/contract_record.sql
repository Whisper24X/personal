CREATE TABLE public.contract_record (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "signFlowId" character varying(128) NOT NULL,
    "parentName" character varying(32) NOT NULL,
    "parentPh" character varying(256) NOT NULL,
    "childName" character varying(32) NOT NULL,
    "childPh" character varying(256) NOT NULL,
    "childId" character varying(256) NOT NULL,
    "userSource" character varying(64) NOT NULL,
    topic character varying(64) NOT NULL,
    "activityStartDate" timestamp with time zone NOT NULL,
    "activityEndDate" timestamp with time zone NOT NULL,
    "purchaseChannel" character varying(32) NOT NULL,
    "childGrade" character varying(16) NOT NULL,
    "childGender" character varying(16) NOT NULL,
    cost character varying(16) NOT NULL,
    "costCapital" character varying(16) NOT NULL,
    "payEndDate" timestamp with time zone NOT NULL,
    "contractStatus" integer NOT NULL,
    "contractLink" character varying(64) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "contractType" smallint DEFAULT 1 NOT NULL
);
COMMENT ON TABLE public.contract_record IS '合同记录表';
COMMENT ON COLUMN public.contract_record.id IS '主键ID（UUID自动生成）';
COMMENT ON COLUMN public.contract_record."signFlowId" IS '签署合同ID（E签宝侧的ID）';
COMMENT ON COLUMN public.contract_record."parentName" IS '家长姓名';
COMMENT ON COLUMN public.contract_record."parentPh" IS '家长联系方式';
COMMENT ON COLUMN public.contract_record."childName" IS '孩子姓名';
COMMENT ON COLUMN public.contract_record."childPh" IS '孩子联系方式';
COMMENT ON COLUMN public.contract_record."childId" IS '孩子身份证ID';
COMMENT ON COLUMN public.contract_record."userSource" IS '用户来源';
COMMENT ON COLUMN public.contract_record.topic IS '主题';
COMMENT ON COLUMN public.contract_record."activityStartDate" IS '营期开始时间';
COMMENT ON COLUMN public.contract_record."activityEndDate" IS '营期结束时间';
COMMENT ON COLUMN public.contract_record."purchaseChannel" IS '购买渠道';
COMMENT ON COLUMN public.contract_record."childGrade" IS '孩子年级';
COMMENT ON COLUMN public.contract_record."childGender" IS '孩子性别';
COMMENT ON COLUMN public.contract_record.cost IS '参营费用';
COMMENT ON COLUMN public.contract_record."costCapital" IS '参营费用大写';
COMMENT ON COLUMN public.contract_record."payEndDate" IS '费用支付截止时间';
COMMENT ON COLUMN public.contract_record."contractStatus" IS '合同状态（0-草稿 1-签署中 2-完成 3-撤销 5-过期 7-拒签）';
COMMENT ON COLUMN public.contract_record."contractLink" IS '合同链接';
COMMENT ON COLUMN public.contract_record."createdAt" IS '创建时间';
COMMENT ON COLUMN public.contract_record."updatedAt" IS '最后更新时间';
COMMENT ON COLUMN public.contract_record."contractType" IS '合同类型：1:单日营；2:多日营';
ALTER TABLE ONLY public.contract_record
    ADD CONSTRAINT contract_record_pkey PRIMARY KEY (id);
CREATE INDEX "idx_contract_record_activityStartDate" ON public.contract_record USING btree ("activityStartDate");
CREATE INDEX "idx_contract_record_childId_topic_activityStartDate" ON public.contract_record USING btree ("childId", topic, "activityStartDate");
CREATE INDEX "idx_contract_record_parentName" ON public.contract_record USING btree ("parentName");
CREATE INDEX "idx_contract_record_signFlowId" ON public.contract_record USING btree ("signFlowId");
CREATE INDEX idx_contract_record_topic ON public.contract_record USING btree (topic);
