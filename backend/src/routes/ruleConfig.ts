import { FastifyInstance } from "fastify";

export default async function ruleConfigRoute(app: FastifyInstance) {

  app.get("/rule-config", async () => {
    return {
      data: app.ruleConfig
    };
  });

  app.patch("/rule-config/:ruleType", async (request, reply) => {
    const { ruleType } = request.params as any;
    const body = request.body as any;
  
    const existing = app.ruleConfig[ruleType];
  
    if (!existing) {
      return reply.status(404).send({
        message: "Rule not found"
      });
    }
  
    const updates: string[] = [];
    const values: any[] = [];
  
    if (body.threshold !== undefined) {
      values.push(body.threshold);
      updates.push(`threshold = $${values.length}`);
    }
  
    if (body.severity !== undefined) {
      values.push(body.severity);
      updates.push(`severity = $${values.length}`);
    }
  
    if (body.window_seconds !== undefined) {
      values.push(body.window_seconds);
      updates.push(`window_seconds = $${values.length}`);
    }
  
    if (updates.length === 0) {
      return reply.status(400).send({
        message: "No valid fields provided"
      });
    }
  
    values.push(ruleType);
  
    const query = `
      UPDATE rule_config
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE rule_type = $${values.length}
      RETURNING *
    `;
  
    const result = await app.pg.query(query, values);
  
    return {
      message: "Rule updated",
      data: result.rows[0]
    };
  });

}
