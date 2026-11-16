import type { ErrorResponse, GreetingResponse } from "@no-blank/shared";
import { asc } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";

import { greetings } from "../db/schema.js";

export const greetingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: { 200: GreetingResponse; 404: ErrorResponse } }>(
    "/greeting",
    async (_request, reply) => {
      const [row] = await app.db
        .select({ message: greetings.message })
        .from(greetings)
        .orderBy(asc(greetings.id))
        .limit(1);

      if (!row) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "No greeting found",
        });
      }

      return { message: row.message };
    },
  );
};
