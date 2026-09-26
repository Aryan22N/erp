import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(__dirname, "../../.env") });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "migration/old-schema/schema.prisma",
  datasource: {
    url: process.env["OLD_DATABASE_URL"],
  },
});