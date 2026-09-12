BEGIN;

INSERT INTO reference.currency_version (
  currency_code, display_name, fraction_digits, valid_from, created_by
) VALUES
  ('DZD', 'Dinar algérien', 2, DATE '2020-01-01', 'local-seed'),
  ('EUR', 'Euro', 2, DATE '2020-01-01', 'local-seed'),
  ('USD', 'Dollar américain', 2, DATE '2020-01-01', 'local-seed')
ON CONFLICT (currency_code, valid_from) DO NOTHING;

INSERT INTO product.investment_product (
  product_id, product_code, product_name, investor_nisba, bank_nisba,
  status
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'MUDARABA_STD',
  'Compte Moudaraba standard',
  70,
  30,
  'DRAFT'
)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO customer.profile (
  customer_id, identity_token, segment, kyc_status, legal_form,
  sector_code, branch_code, updated_by
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'tok_local_customer_0001',
  'RETAIL',
  'VERIFIED',
  'PERSONNE_PHYSIQUE',
  'PARTICULIER',
  '001',
  'local-seed'
)
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO pooling.pool (
  pool_id, display_name, currency_code, status, strategy_code, valid_from,
  eligible_asset_codes, mudarib_profit_share
) VALUES
  ('GLOBAL_POOL', 'Pool global participatif', 'DZD', 'ACTIVE', 'BALANCED', DATE '2026-01-01', ARRAY['MURABAHA', 'IJARA'], 30),
  ('REAL_ESTATE', 'Financement immobilier', 'DZD', 'ACTIVE', 'REAL_ESTATE', DATE '2026-01-01', ARRAY['MURABAHA_RE'], 30),
  ('EQUIPMENT', 'Financement équipement', 'DZD', 'ACTIVE', 'EQUIPMENT', DATE '2026-01-01', ARRAY['IJARA_EQ'], 30)
ON CONFLICT (pool_id) DO NOTHING;

COMMIT;
