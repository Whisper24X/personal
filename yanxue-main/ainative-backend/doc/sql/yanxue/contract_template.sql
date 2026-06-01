CREATE TABLE public.contract_template (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "templateName" character varying(64) NOT NULL,
    "templateUrl" character varying(256) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    status integer NOT NULL,
    "updatedBy" character varying(64) NOT NULL,
    "templateType" smallint DEFAULT 1 NOT NULL
);
COMMENT ON TABLE public.contract_template IS '合同模版';
COMMENT ON COLUMN public.contract_template.id IS 'id';
COMMENT ON COLUMN public.contract_template."templateName" IS '模版名称';
COMMENT ON COLUMN public.contract_template."templateUrl" IS '模版url';
COMMENT ON COLUMN public.contract_template."createdAt" IS '创建时间';
COMMENT ON COLUMN public.contract_template."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.contract_template.status IS '状态：-1:删除；1:正常';
COMMENT ON COLUMN public.contract_template."updatedBy" IS '操作人';
COMMENT ON COLUMN public.contract_template."templateType" IS '模版类型：1:单日营；2：多日营';
ALTER TABLE ONLY public.contract_template
    ADD CONSTRAINT contract_template_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX "idx_templateName" ON public.contract_template USING btree ("templateName");
