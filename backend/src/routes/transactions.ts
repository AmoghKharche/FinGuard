import { FastifyInstance } from "fastify";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstIso(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.toISOString();
}

export default async function transactionsRoute(app: FastifyInstance) {

  app.get("/transactions", async (request, reply) => {
    const page = Number((request.query as any).page) || 1;
    const limit = Number((request.query as any).limit) || 20;
    const decision = (request.query as any).decision;

    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT transaction_id, risk_score, decision, created_at
      FROM transaction_decisions
    `;

    const values: any[] = [];

    if (decision) {
      baseQuery += ` WHERE decision = $1`;
      values.push(decision);
    }

    baseQuery += `
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const dataResult = await app.pg.query(baseQuery, values);

    const rows = dataResult.rows.map(row => ({
      ...row,
      created_at_ist: row.created_at ? toIstIso(new Date(row.created_at)) : null
    }));

    const countResult = await app.pg.query(
      `SELECT COUNT(*) FROM transaction_decisions`
    );

    return {
      data: rows,
      page,
      limit,
      total: Number(countResult.rows[0].count)
    };
  });

}