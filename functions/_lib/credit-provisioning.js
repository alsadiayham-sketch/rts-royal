const DEFAULT_CREDIT_SETTINGS = {
  messageBalance: 500,
  customerPriceAgorot: 20,
  platformCostAgorot: 10,
};

async function creditSettings(db) {
  await db.prepare(
    `INSERT OR IGNORE INTO credit_settings
       (id, default_message_balance, customer_price_agorot, platform_cost_agorot)
     VALUES (1, ?, ?, ?)`
  )
    .bind(
      DEFAULT_CREDIT_SETTINGS.messageBalance,
      DEFAULT_CREDIT_SETTINGS.customerPriceAgorot,
      DEFAULT_CREDIT_SETTINGS.platformCostAgorot
    )
    .run();
  return db.prepare(
    `SELECT default_message_balance, customer_price_agorot, platform_cost_agorot
     FROM credit_settings WHERE id = 1`
  ).first();
}

export async function createCreditAccount(db, organizationType, organizationId, displayName) {
  const existing = await db.prepare(
    `SELECT 1 FROM credit_accounts
     WHERE organization_type = ? AND organization_id = ?`
  ).bind(organizationType, organizationId).first();
  if (existing) return false;

  const settings = await creditSettings(db);
  const result = await db.prepare(
    `INSERT OR IGNORE INTO credit_accounts
       (organization_type, organization_id, display_name, message_balance, money_balance_agorot,
        customer_price_agorot, platform_cost_agorot, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, unixepoch(), unixepoch())`
  )
    .bind(
      organizationType,
      organizationId,
      displayName,
      Number(settings?.default_message_balance ?? DEFAULT_CREDIT_SETTINGS.messageBalance),
      Number(settings?.customer_price_agorot ?? DEFAULT_CREDIT_SETTINGS.customerPriceAgorot),
      Number(settings?.platform_cost_agorot ?? DEFAULT_CREDIT_SETTINGS.platformCostAgorot)
    )
    .run();
  return Number(result?.meta?.changes || 0) > 0;
}

export async function deleteNewCreditAccount(db, organizationType, organizationId) {
  await db.prepare(
    `DELETE FROM credit_accounts
     WHERE organization_type = ? AND organization_id = ?`
  ).bind(organizationType, organizationId).run();
}
