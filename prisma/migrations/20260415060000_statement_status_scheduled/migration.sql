-- Projeção de faturas futuras para parcelas (M2): estado distinto de open/closed/paid.
ALTER TYPE "StatementStatus" ADD VALUE IF NOT EXISTS 'scheduled';
