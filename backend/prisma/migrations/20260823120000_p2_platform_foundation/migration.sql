-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('setup', 'active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'customer', 'system');

-- CreateEnum
CREATE TYPE "MissionPhase" AS ENUM ('setup', 'foundation', 'activation', 'scale');

-- CreateEnum
CREATE TYPE "MissionScope" AS ENUM ('food', 'art', 'lifestyle', 'system', 'mixed');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('planned', 'active', 'completed', 'paused');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('planned', 'active', 'completed', 'blocked');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'doing', 'done', 'blocked', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('core', 'adhoc', 'improvement');

-- CreateEnum
CREATE TYPE "TaskDomain" AS ENUM ('food', 'art', 'lifestyle', 'ops', 'procurement', 'bi', 'talent', 'tech', 'design');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TaskSubjectType" AS ENUM ('recipe', 'product', 'event', 'vendor', 'purchase_order', 'prep_batch', 'order', 'decision');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('image', 'document', 'video', 'link', 'note', 'system');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('manual', 'bridge');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('task', 'evidence', 'decision', 'recipe');

-- CreateEnum
CREATE TYPE "ApprovalScope" AS ENUM ('task', 'decision', 'recipe', 'pricing', 'vendor', 'experience', 'tech', 'hiring', 'review');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('all', 'n_of');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('proposed', 'aligned', 'approved', 'rejected', 'reopened');

-- CreateEnum
CREATE TYPE "GovernanceTier" AS ENUM ('tier_1', 'tier_2', 'tier_3');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('approve', 'reject', 'abstain');

-- CreateEnum
CREATE TYPE "MeterMode" AS ENUM ('task_driven', 'derived', 'hybrid');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('prepared_food', 'packaged', 'experience', 'merchandise');

-- CreateEnum
CREATE TYPE "FulfilmentType" AS ENUM ('local', 'shipped', 'booking');

-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('derived_from_recipe', 'tracked', 'capacity');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('dine_in', 'takeaway', 'delivery', 'marketplace');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('placed', 'confirmed', 'preparing', 'ready', 'served', 'dispatched', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'preparing', 'ready', 'packed', 'shipped', 'delivered', 'attended', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('pos', 'storefront', 'webhook_fallback');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('picked_up', 'in_transit', 'delivered');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'upi', 'razorpay');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('dining', 'workshop', 'pop_up', 'tasting', 'other');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'upcoming', 'live', 'past', 'cancelled');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('held', 'confirmed', 'cancelled', 'attended', 'no_show');

-- CreateEnum
CREATE TYPE "ShippingProvider" AS ENUM ('shiprocket', 'manual');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('pending', 'awb_assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('percent', 'fixed', 'free_shipping');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('member', 'regular', 'insider');

-- CreateEnum
CREATE TYPE "LoyaltyReason" AS ENUM ('earn', 'redeem', 'adjust', 'expire');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'published', 'hidden');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('draft', 'pending', 'approved', 'archived');

-- CreateEnum
CREATE TYPE "PreparationType" AS ENUM ('scratch', 'batch_prepared', 'ready_to_sell', 'assemble');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('recipe_input', 'supply', 'equipment');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('purchase_received', 'prep_deducted', 'order_deducted', 'waste', 'adjustment', 'supply_usage', 'import', 'shipment_packed', 'return');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'ordered', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "PrepBatchStatus" AS ENUM ('active', 'depleted', 'expired');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('task_due', 'task_blocked', 'approval_pending', 'low_stock', 'new_order', 'order_ready', 'delivery_update', 'admin_notice');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'whatsapp');

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "NodeStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'system',
    "actor_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "permissions" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "xp_total" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "phase" "MissionPhase" NOT NULL DEFAULT 'setup',
    "scope" "MissionScope" NOT NULL DEFAULT 'food',
    "status" "MissionStatus" NOT NULL DEFAULT 'planned',
    "start_date" TIMESTAMPTZ(3),
    "end_date" TIMESTAMPTZ(3),
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "mission_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'planned',
    "baseline_task_count" INTEGER NOT NULL DEFAULT 0,
    "core_progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adhoc_progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start_date" TIMESTAMPTZ(3),
    "end_date" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "mission_id" TEXT NOT NULL,
    "quest_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "task_type" "TaskType" NOT NULL DEFAULT 'core',
    "domain" "TaskDomain" NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "subject_type" "TaskSubjectType",
    "subject_id" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 25,
    "valid_xp" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "depends_on_task_id" TEXT,
    "readiness_meter_id" TEXT,
    "readiness_value" INTEGER NOT NULL DEFAULT 0,
    "kpi_id" TEXT,
    "due_date" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "source" "EvidenceSource" NOT NULL DEFAULT 'manual',
    "bridge_event" TEXT,
    "url" TEXT NOT NULL,
    "notes" TEXT,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "entity_type" "ApprovalEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "approval_scope" "ApprovalScope" NOT NULL,
    "required_role_code" TEXT NOT NULL,
    "approved_by" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "override_by" TEXT,
    "override_reason" TEXT,
    "override_at" TIMESTAMPTZ(3),
    "delegated_from_user_id" TEXT,
    "policy_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "title" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "proposed_by" TEXT NOT NULL,
    "impact_scope" TEXT NOT NULL,
    "final_decision" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'proposed',
    "tier" "GovernanceTier" NOT NULL DEFAULT 'tier_1',
    "required_role_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "linked_task_id" TEXT,
    "linked_mission_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "scope" "ApprovalScope" NOT NULL,
    "domain" "TaskDomain",
    "required_role_codes" TEXT[],
    "min_approvals" INTEGER NOT NULL DEFAULT 1,
    "mode" "ApprovalMode" NOT NULL DEFAULT 'all',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionVote" (
    "id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "vote" "VoteValue" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessSignal" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "meter_id" TEXT NOT NULL,
    "source_event" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessSnapshot" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "meter_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "ReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDelegation" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(3) NOT NULL,
    "end_date" TIMESTAMPTZ(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessMeter" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_value" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "mode" "MeterMode" NOT NULL DEFAULT 'task_driven',
    "formula_key" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReadinessMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReadinessEvent" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "readiness_meter_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskReadinessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'on_track',
    "domain" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ModuleAccess" (
    "module_key" TEXT NOT NULL,
    "role_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModuleAccess_pkey" PRIMARY KEY ("module_key")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "zone_type" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "brand_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "owner_user_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "linked_task_id" TEXT,
    "linked_brand_id" TEXT,
    "linked_recipe_id" TEXT,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prep_steps" TEXT,
    "cooking_method" TEXT,
    "yield_qty" DECIMAL(14,4) NOT NULL,
    "yield_unit" TEXT NOT NULL,
    "portion_size" TEXT NOT NULL,
    "shelf_life_hours" INTEGER,
    "brand_id" TEXT,
    "zone_id" TEXT,
    "image_url" TEXT,
    "computed_cost" DECIMAL(12,2),
    "status" "RecipeStatus" NOT NULL DEFAULT 'draft',
    "preparation_type" "PreparationType" NOT NULL DEFAULT 'scratch',
    "parent_recipe_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "input_type" TEXT NOT NULL,
    "ingredient_id" TEXT,
    "source_recipe_id" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "prep_notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IngredientCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "usage_type" "UsageType" NOT NULL DEFAULT 'recipe_input',
    "category_id" TEXT,
    "base_unit" TEXT NOT NULL,
    "min_stock_level" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "from_unit" TEXT NOT NULL,
    "to_unit" TEXT NOT NULL,
    "factor" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "payment_terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPrice" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "effective_date" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "product_types" "ProductType"[] DEFAULT ARRAY[]::"ProductType"[],
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "story" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hsn_code" TEXT,
    "fulfilment" "FulfilmentType" NOT NULL DEFAULT 'local',
    "stock_mode" "StockMode" NOT NULL DEFAULT 'derived_from_recipe',
    "recipe_id" TEXT,
    "event_id" TEXT,
    "weight_grams" INTEGER,
    "dimensions_cm" JSONB,
    "shelf_life_days" INTEGER,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "rating_avg" DECIMAL(3,2),
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock_on_hand" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "low_stock_threshold" DECIMAL(14,4),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "kind" "MediaKind" NOT NULL DEFAULT 'image',

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelModifier" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "channel" "OrderChannel" NOT NULL,
    "modifier_type" TEXT NOT NULL,
    "modifier_value" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "ChannelModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientStock" (
    "id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "current_quantity" DECIMAL(14,4) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IngredientStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "original_quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_by" TEXT,
    "actor_type" "ActorType" NOT NULL DEFAULT 'user',
    "actor_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "vendor_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "ordered_by" TEXT NOT NULL,
    "ordered_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "linked_task_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "received_quantity" DECIMAL(14,4),

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepBatch" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "recipe_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "quantity_produced" DECIMAL(14,4) NOT NULL,
    "quantity_remaining" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "prepared_by" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "status" "PrepBatchStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteLog" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "waste_type" TEXT NOT NULL,
    "ingredient_id" TEXT,
    "prep_batch_id" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reason_notes" TEXT,
    "cost_impact" DECIMAL(12,2) NOT NULL,
    "logged_by" TEXT,
    "zone_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "order_number" SERIAL NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'placed',
    "table_number" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "delivery_address" TEXT,
    "delivery_assigned_to" TEXT,
    "delivery_status" "DeliveryStatus",
    "placed_via" "OrderSource" NOT NULL DEFAULT 'pos',
    "customer_id" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "channel_modifier_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "loyalty_points_earned" INTEGER NOT NULL DEFAULT 0,
    "loyalty_points_redeemed" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "address_snapshot" JSONB,
    "notes" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "zone_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "item_notes" TEXT,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'pending',
    "fulfilment" "FulfilmentType" NOT NULL DEFAULT 'local',
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ready_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "refunded_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel"[] DEFAULT ARRAY['in_app']::"NotificationChannel"[],
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "title" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "zone_id" TEXT,
    "brand_id" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'upcoming',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventBooking" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "guests" INTEGER NOT NULL,
    "customer_id" TEXT,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "status" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "hold_expires_at" TIMESTAMPTZ(3),
    "payment_amount" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "accent_color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "role_codes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GuideSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidePage" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "estimated_read_time" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GuidePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters_applied" TEXT,
    "file_size_bytes" INTEGER NOT NULL,
    "r2_key" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "avatar_key" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMPTZ(3),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT,
    "attachment_key" TEXT,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "attachment_type" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Node_code_key" ON "Node"("code");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_type_entity_id_created_at_idx" ON "AuditEvent"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditEvent_node_id_created_at_idx" ON "AuditEvent"("node_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_xp_total_idx" ON "User"("status", "xp_total" DESC);

-- CreateIndex
CREATE INDEX "User_role_id_idx" ON "User"("role_id");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_token_hash_idx" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_hash_idx" ON "PasswordResetToken"("token_hash");

-- CreateIndex
CREATE INDEX "Task_owner_user_id_status_idx" ON "Task"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "Task_quest_id_valid_idx" ON "Task"("quest_id", "valid");

-- CreateIndex
CREATE INDEX "Task_mission_id_idx" ON "Task"("mission_id");

-- CreateIndex
CREATE INDEX "Task_due_date_status_idx" ON "Task"("due_date", "status");

-- CreateIndex
CREATE INDEX "Task_valid_completed_at_idx" ON "Task"("valid", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "Task_subject_type_subject_id_idx" ON "Task"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "Task_status_due_date_idx" ON "Task"("status", "due_date");

-- CreateIndex
CREATE INDEX "Evidence_task_id_idx" ON "Evidence"("task_id");

-- CreateIndex
CREATE INDEX "Evidence_approval_status_created_at_idx" ON "Evidence"("approval_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Approval_status_created_at_idx" ON "Approval"("status", "created_at");

-- CreateIndex
CREATE INDEX "Approval_entity_type_entity_id_idx" ON "Approval"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_node_id_is_default_idx" ON "ApprovalPolicy"("node_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_node_id_scope_domain_key" ON "ApprovalPolicy"("node_id", "scope", "domain");

-- CreateIndex
CREATE INDEX "DecisionVote_decision_id_idx" ON "DecisionVote"("decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionVote_decision_id_user_id_key" ON "DecisionVote"("decision_id", "user_id");

-- CreateIndex
CREATE INDEX "ReadinessSignal_meter_id_created_at_idx" ON "ReadinessSignal"("meter_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ReadinessSignal_source_type_source_id_idx" ON "ReadinessSignal"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "ReadinessSnapshot_node_id_date_idx" ON "ReadinessSnapshot"("node_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessSnapshot_meter_id_date_key" ON "ReadinessSnapshot"("meter_id", "date");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_to_user_id_active_start_date_end_date_idx" ON "ApprovalDelegation"("to_user_id", "active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_from_user_id_active_idx" ON "ApprovalDelegation"("from_user_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessMeter_node_id_code_key" ON "ReadinessMeter"("node_id", "code");

-- CreateIndex
CREATE INDEX "ModuleAccess_sort_order_idx" ON "ModuleAccess"("sort_order");

-- CreateIndex
CREATE INDEX "RecipeLine_recipe_id_idx" ON "RecipeLine"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientCategory_name_key" ON "IngredientCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_from_unit_to_unit_key" ON "UnitConversion"("from_unit", "to_unit");

-- CreateIndex
CREATE INDEX "VendorPrice_ingredient_id_effective_date_idx" ON "VendorPrice"("ingredient_id", "effective_date" DESC);

-- CreateIndex
CREATE INDEX "VendorPrice_vendor_id_idx" ON "VendorPrice"("vendor_id");

-- CreateIndex
CREATE INDEX "ProductCategory_brand_id_idx" ON "ProductCategory"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_node_id_slug_key" ON "ProductCategory"("node_id", "slug");

-- CreateIndex
CREATE INDEX "Product_node_id_type_status_idx" ON "Product"("node_id", "type", "status");

-- CreateIndex
CREATE INDEX "Product_category_id_idx" ON "Product"("category_id");

-- CreateIndex
CREATE INDEX "Product_recipe_id_idx" ON "Product"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_node_id_slug_key" ON "Product"("node_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_product_id_idx" ON "ProductVariant"("product_id");

-- CreateIndex
CREATE INDEX "ProductMedia_product_id_sort_order_idx" ON "ProductMedia"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelModifier_node_id_channel_key" ON "ChannelModifier"("node_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientStock_ingredient_id_zone_id_key" ON "IngredientStock"("ingredient_id", "zone_id");

-- CreateIndex
CREATE INDEX "StockMovement_ingredient_id_created_at_idx" ON "StockMovement"("ingredient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "StockMovement_zone_id_created_at_idx" ON "StockMovement"("zone_id", "created_at");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_ordered_at_idx" ON "PurchaseOrder"("status", "ordered_at");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendor_id_idx" ON "PurchaseOrder"("vendor_id");

-- CreateIndex
CREATE INDEX "PurchaseOrder_linked_task_id_idx" ON "PurchaseOrder"("linked_task_id");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_po_id_idx" ON "PurchaseOrderLine"("po_id");

-- CreateIndex
CREATE INDEX "PrepBatch_recipe_id_status_zone_id_idx" ON "PrepBatch"("recipe_id", "status", "zone_id");

-- CreateIndex
CREATE INDEX "PrepBatch_zone_id_status_idx" ON "PrepBatch"("zone_id", "status");

-- CreateIndex
CREATE INDEX "PrepBatch_created_at_idx" ON "PrepBatch"("created_at");

-- CreateIndex
CREATE INDEX "WasteLog_created_at_idx" ON "WasteLog"("created_at");

-- CreateIndex
CREATE INDEX "WasteLog_zone_id_created_at_idx" ON "WasteLog"("zone_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "CustomerAddress_customer_id_idx" ON "CustomerAddress"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_order_number_key" ON "Order"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotency_key_key" ON "Order"("idempotency_key");

-- CreateIndex
CREATE INDEX "Order_status_created_at_idx" ON "Order"("status", "created_at");

-- CreateIndex
CREATE INDEX "Order_channel_idx" ON "Order"("channel");

-- CreateIndex
CREATE INDEX "Order_zone_id_status_idx" ON "Order"("zone_id", "status");

-- CreateIndex
CREATE INDEX "Order_customer_id_idx" ON "Order"("customer_id");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItem_status_ready_at_idx" ON "OrderItem"("status", "ready_at");

-- CreateIndex
CREATE INDEX "OrderItem_product_id_idx" ON "OrderItem"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_order_id_key" ON "Payment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpay_order_id_key" ON "Payment"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpay_payment_id_key" ON "Payment"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "Notification_user_id_is_read_created_at_idx" ON "Notification"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Notification_user_id_type_reference_id_idx" ON "Notification"("user_id", "type", "reference_id");

-- CreateIndex
CREATE INDEX "Feedback_order_id_idx" ON "Feedback"("order_id");

-- CreateIndex
CREATE INDEX "Feedback_created_at_idx" ON "Feedback"("created_at" DESC);

-- CreateIndex
CREATE INDEX "Feedback_rating_idx" ON "Feedback"("rating");

-- CreateIndex
CREATE INDEX "Feedback_customer_id_idx" ON "Feedback"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_razorpay_order_id_key" ON "EventBooking"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_razorpay_payment_id_key" ON "EventBooking"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "EventBooking_customer_id_idx" ON "EventBooking"("customer_id");

-- CreateIndex
CREATE INDEX "EventBooking_razorpay_order_id_idx" ON "EventBooking"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_event_id_customer_phone_key" ON "EventBooking"("event_id", "customer_phone");

-- CreateIndex
CREATE UNIQUE INDEX "GuideSection_slug_key" ON "GuideSection"("slug");

-- CreateIndex
CREATE INDEX "GuideSection_status_idx" ON "GuideSection"("status");

-- CreateIndex
CREATE INDEX "GuideSection_sort_order_idx" ON "GuideSection"("sort_order");

-- CreateIndex
CREATE INDEX "GuidePage_section_id_sort_order_idx" ON "GuidePage"("section_id", "sort_order");

-- CreateIndex
CREATE INDEX "GuidePage_status_idx" ON "GuidePage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuidePage_section_id_slug_key" ON "GuidePage"("section_id", "slug");

-- CreateIndex
CREATE INDEX "ExportRecord_report_type_created_at_idx" ON "ExportRecord"("report_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ExportRecord_generated_by_created_at_idx" ON "ExportRecord"("generated_by", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ExportRecord_status_created_at_idx" ON "ExportRecord"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Conversation_created_by_idx" ON "Conversation"("created_by");

-- CreateIndex
CREATE INDEX "Conversation_updated_at_idx" ON "Conversation"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "ConversationParticipant_user_id_idx" ON "ConversationParticipant"("user_id");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversation_id_idx" ON "ConversationParticipant"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversation_id_user_id_key" ON "ConversationParticipant"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "Message_conversation_id_created_at_idx" ON "Message"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Message_sender_id_idx" ON "Message"("sender_id");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_readiness_meter_id_fkey" FOREIGN KEY ("readiness_meter_id") REFERENCES "ReadinessMeter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "Kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_override_by_fkey" FOREIGN KEY ("override_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_delegated_from_user_id_fkey" FOREIGN KEY ("delegated_from_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_linked_mission_id_fkey" FOREIGN KEY ("linked_mission_id") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSignal" ADD CONSTRAINT "ReadinessSignal_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSignal" ADD CONSTRAINT "ReadinessSignal_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "ReadinessMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSnapshot" ADD CONSTRAINT "ReadinessSnapshot_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSnapshot" ADD CONSTRAINT "ReadinessSnapshot_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "ReadinessMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessMeter" ADD CONSTRAINT "ReadinessMeter_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReadinessEvent" ADD CONSTRAINT "TaskReadinessEvent_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReadinessEvent" ADD CONSTRAINT "TaskReadinessEvent_readiness_meter_id_fkey" FOREIGN KEY ("readiness_meter_id") REFERENCES "ReadinessMeter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_linked_brand_id_fkey" FOREIGN KEY ("linked_brand_id") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_linked_recipe_id_fkey" FOREIGN KEY ("linked_recipe_id") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_source_recipe_id_fkey" FOREIGN KEY ("source_recipe_id") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "IngredientCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPrice" ADD CONSTRAINT "VendorPrice_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPrice" ADD CONSTRAINT "VendorPrice_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelModifier" ADD CONSTRAINT "ChannelModifier_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientStock" ADD CONSTRAINT "IngredientStock_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientStock" ADD CONSTRAINT "IngredientStock_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_ordered_by_fkey" FOREIGN KEY ("ordered_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_prep_batch_id_fkey" FOREIGN KEY ("prep_batch_id") REFERENCES "PrepBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBooking" ADD CONSTRAINT "EventBooking_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBooking" ADD CONSTRAINT "EventBooking_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidePage" ADD CONSTRAINT "GuidePage_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "GuideSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── SPEC §3.4 CHECK constraints (not expressible in Prisma schema) ──────────
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_input_xor"
  CHECK (
    (("input_type" = 'ingredient') = ("ingredient_id" IS NOT NULL))
    AND (("input_type" = 'recipe') = ("source_recipe_id" IS NOT NULL))
  );

ALTER TABLE "IngredientStock" ADD CONSTRAINT "IngredientStock_quantity_non_negative"
  CHECK ("current_quantity" >= 0);

ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_source_xor"
  CHECK (
    (("waste_type" = 'ingredient') = ("ingredient_id" IS NOT NULL))
    AND (("waste_type" = 'prep_batch') = ("prep_batch_id" IS NOT NULL))
  );

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_non_negative"
  CHECK ("stock_on_hand" >= 0);

-- ─── SPEC §5.4 product search (tsvector via trigger + GIN index) ─────────────
CREATE OR REPLACE FUNCTION product_search_text_refresh() RETURNS trigger AS $$
BEGIN
  NEW."search_text" :=
    coalesce(NEW."name", '') || ' ' ||
    coalesce(NEW."description", '') || ' ' ||
    coalesce(NEW."story", '') || ' ' ||
    coalesce((SELECT c."name" FROM "ProductCategory" c WHERE c."id" = NEW."category_id"), '') || ' ' ||
    coalesce((SELECT b."name" FROM "Brand" b WHERE b."id" = NEW."brand_id"), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_text_trg
  BEFORE INSERT OR UPDATE OF "name", "description", "story", "category_id", "brand_id"
  ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_text_refresh();

CREATE INDEX "Product_search_text_gin"
  ON "Product" USING GIN (to_tsvector('simple', "search_text"));

-- ─── Carried over from v1 migration 20260323051500_add_guide_search_text ─────
-- GuidePage.search_text is maintained by a trigger and queried through a GIN
-- index by GuidesService.search(); neither is expressible in the Prisma
-- datamodel, so the single baseline has to re-declare them.
CREATE OR REPLACE FUNCTION guide_page_search_text_sync() RETURNS trigger AS $$
BEGIN
  NEW."search_text" :=
    NEW."title" || ' ' ||
    COALESCE(
      regexp_replace(NEW."content"::text, '"text":"([^"]+)"', '\1 ', 'g'),
      ''
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guide_page_search_text_trigger
  BEFORE INSERT OR UPDATE OF "content", "title"
  ON "GuidePage"
  FOR EACH ROW EXECUTE FUNCTION guide_page_search_text_sync();

CREATE INDEX "GuidePage_search_text_gin_idx"
  ON "GuidePage" USING GIN (to_tsvector('english', "search_text"));
