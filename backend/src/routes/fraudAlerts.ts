import { FastifyInstance } from "fastify";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstIso(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.toISOString();
}

export default async function fraudAlertsRoute(app: FastifyInstance) {

  app.get("/fraud-alerts", async (request, reply) => {
    const query = request.query as any;

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const ruleType = query.ruleType;
    const cardHash = query.cardHash;

    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT 
        id,
        card_hash,
        rule_type,
        transaction_count,
        window_bucket,
        last_updated
      FROM fraud_alerts
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (ruleType) {
      values.push(ruleType);
      conditions.push(`rule_type = $${values.length}`);
    }

    if (cardHash) {
      values.push(cardHash);
      conditions.push(`card_hash = $${values.length}`);
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ` + conditions.join(" AND ");
    }

    baseQuery += `
      ORDER BY last_updated DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const dataResult = await app.pg.query(baseQuery, values);

    const rows = dataResult.rows.map(row => ({
      ...row,
      last_updated_ist: row.last_updated ? toIstIso(new Date(row.last_updated)) : null
    }));

    const countResult = await app.pg.query(
      `SELECT COUNT(*) FROM fraud_alerts`
    );

    return {
      data: rows,
      page,
      limit,
      total: Number(countResult.rows[0].count)
    };
  });

}