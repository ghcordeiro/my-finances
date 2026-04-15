-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('open', 'closed', 'paid');

-- CreateEnum
CREATE TYPE "StatementLineKind" AS ENUM ('purchase', 'installment', 'credit', 'adjustment');

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "credit_limit" DECIMAL(18,2) NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_statements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "StatementStatus" NOT NULL,
    "closed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_card_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "purchase_amount" DECIMAL(18,2) NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "merchant_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_statement_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "line_kind" "StatementLineKind" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "installment_plan_id" TEXT,
    "installment_index" INTEGER,
    "references_line_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_card_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_cards_workspace_id_idx" ON "credit_cards"("workspace_id");

-- CreateIndex
CREATE INDEX "credit_cards_organization_id_idx" ON "credit_cards"("organization_id");

-- CreateIndex
CREATE INDEX "credit_card_statements_credit_card_id_status_idx" ON "credit_card_statements"("credit_card_id", "status");

-- CreateIndex
CREATE INDEX "credit_card_statements_organization_id_idx" ON "credit_card_statements"("organization_id");

-- CreateIndex
CREATE INDEX "installment_plans_credit_card_id_idx" ON "installment_plans"("credit_card_id");

-- CreateIndex
CREATE INDEX "installment_plans_organization_id_idx" ON "installment_plans"("organization_id");

-- CreateIndex
CREATE INDEX "credit_card_statement_lines_statement_id_idx" ON "credit_card_statement_lines"("statement_id");

-- CreateIndex
CREATE INDEX "credit_card_statement_lines_installment_plan_id_idx" ON "credit_card_statement_lines"("installment_plan_id");

-- CreateIndex
CREATE INDEX "credit_card_statement_lines_organization_id_idx" ON "credit_card_statement_lines"("organization_id");

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_statements" ADD CONSTRAINT "credit_card_statements_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_statement_lines" ADD CONSTRAINT "credit_card_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "credit_card_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_statement_lines" ADD CONSTRAINT "credit_card_statement_lines_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "installment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_statement_lines" ADD CONSTRAINT "credit_card_statement_lines_references_line_id_fkey" FOREIGN KEY ("references_line_id") REFERENCES "credit_card_statement_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
