-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('pending', 'processing', 'completed', 'partial', 'failed');

-- CreateTable
CREATE TABLE "csv_import_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "name" TEXT NOT NULL,
    "column_map" JSONB NOT NULL,
    "date_format" TEXT NOT NULL,
    "decimal_separator" TEXT NOT NULL,
    "timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "target_account_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_sha256" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "mime_type" TEXT,
    "storage_key" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL,
    "result_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_import_postings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "booked_at" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "external_stable_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_import_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csv_import_templates_organization_id_idx" ON "csv_import_templates"("organization_id");

-- CreateIndex
CREATE INDEX "csv_import_templates_workspace_id_idx" ON "csv_import_templates"("workspace_id");

-- CreateIndex
CREATE INDEX "import_batches_organization_id_idx" ON "import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "import_batches_workspace_id_idx" ON "import_batches"("workspace_id");

-- CreateIndex
CREATE INDEX "import_batches_target_account_id_idx" ON "import_batches"("target_account_id");

-- CreateIndex
CREATE INDEX "import_batches_content_sha256_idx" ON "import_batches"("content_sha256");

-- CreateIndex
CREATE INDEX "account_import_postings_account_id_idx" ON "account_import_postings"("account_id");

-- CreateIndex
CREATE INDEX "account_import_postings_import_batch_id_idx" ON "account_import_postings"("import_batch_id");

-- CreateIndex
CREATE INDEX "account_import_postings_organization_id_idx" ON "account_import_postings"("organization_id");

-- Partial unique: template name per org and optional workspace (ADR-0011 §1)
CREATE UNIQUE INDEX "csv_import_templates_org_workspace_name_key" ON "csv_import_templates" ("organization_id", COALESCE("workspace_id", ''), "name");

-- Partial unique: duplicate batch by content hash (ADR-0011 §3)
CREATE UNIQUE INDEX "import_batches_workspace_account_sha_completed_partial" ON "import_batches" ("workspace_id", "target_account_id", "content_sha256") WHERE "status" IN ('completed', 'partial');

-- Partial unique: line idempotency when external id present (ADR-0011 §1)
CREATE UNIQUE INDEX "account_import_postings_account_external_partial" ON "account_import_postings" ("account_id", "external_stable_id") WHERE "external_stable_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "csv_import_templates" ADD CONSTRAINT "csv_import_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_templates" ADD CONSTRAINT "csv_import_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_import_postings" ADD CONSTRAINT "account_import_postings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_import_postings" ADD CONSTRAINT "account_import_postings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_import_postings" ADD CONSTRAINT "account_import_postings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_import_postings" ADD CONSTRAINT "account_import_postings_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
