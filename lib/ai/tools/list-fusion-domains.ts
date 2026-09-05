import { tool } from "ai";
import { z } from "zod";
import taxonomy from "@/lib/fusion/domain-taxonomy.json";

type DomainEntry = {
  module: string;
  docModule: string;
  docSection: string;
  tableCount: number;
};

const domains = taxonomy as DomainEntry[];

export const listFusionDomains = tool({
  description:
    "List the Oracle Fusion functional domain taxonomy (Oracle's own doc modules and sections, with table counts). Use this to decide WHICH functional area a question belongs to before searching for tables - e.g. sales orders live under order_management, not inventory_management. Optionally filter by module.",
  execute: ({ module }) => {
    const filtered = module
      ? domains.filter((d) => d.module === module)
      : domains;
    return Promise.resolve({
      domains: filtered,
      usage:
        "Pass a docSection value to searchFusionTables to scope results to that functional area. Section filters only cover documented tables; search without a filter to include undocumented ones.",
    });
  },
  inputSchema: z.object({
    module: z
      .enum([
        "financials",
        "hcm",
        "scm",
        "procurement",
        "sales",
        "cx",
        "erp",
        "common",
        "project_management",
      ])
      .optional()
      .describe("Optional: limit the taxonomy to one top-level module"),
  }),
});
