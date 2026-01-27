-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."good_recommendation_category" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    "icon" varchar(500),
    "status" int4 NOT NULL DEFAULT -1,
    "sortOrder" int4 NOT NULL DEFAULT 0,
    "goodItems" jsonb,
    "createdAt" timestamptz NOT NULL,
    "updatedAt" timestamptz NOT NULL,
    "updatedBy" varchar(255),
    PRIMARY KEY ("id")
);

-- Column Comment
COMMENT ON COLUMN "public"."good_recommendation_category"."id" IS 'id';
COMMENT ON COLUMN "public"."good_recommendation_category"."name" IS '分类名称';
COMMENT ON COLUMN "public"."good_recommendation_category"."icon" IS '分类图标URL';
COMMENT ON COLUMN "public"."good_recommendation_category"."status" IS '状态：-1-下架，1-上架';
COMMENT ON COLUMN "public"."good_recommendation_category"."sortOrder" IS '排序号，数字越小排序越靠前';
COMMENT ON COLUMN "public"."good_recommendation_category"."goodItems" IS '商品内容JSON数组，格式：[{"goodId": "uuid", "sortOrder": 1}]';
COMMENT ON COLUMN "public"."good_recommendation_category"."createdAt" IS '创建时间';
COMMENT ON COLUMN "public"."good_recommendation_category"."updatedAt" IS '更新时间';
COMMENT ON COLUMN "public"."good_recommendation_category"."updatedBy" IS '最后修改人';

-- Comments
COMMENT ON TABLE "public"."good_recommendation_category" IS '商品推荐分类表';

-- Example data format for good_items field:
-- [
--   {"goodId": "550e8400-e29b-41d4-a716-446655440000", "sortOrder": 1},
--   {"goodId": "550e8400-e29b-41d4-a716-446655440001", "sortOrder": 2},
--   {"goodId": "550e8400-e29b-41d4-a716-446655440002", "sortOrder": 3}
-- ]