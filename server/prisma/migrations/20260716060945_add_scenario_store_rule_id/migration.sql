-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "store_rule_id" UUID;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_store_rule_id_fkey" FOREIGN KEY ("store_rule_id") REFERENCES "store_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
