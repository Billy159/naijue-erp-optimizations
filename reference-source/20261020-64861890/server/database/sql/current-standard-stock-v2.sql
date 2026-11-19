-- Unit-free rebuildable read component. Source labels remain archived; real identities/core ledger are unchanged.
SET LOCAL ROLE __RUNTIME_OWNER__;
CREATE TABLE __RUNTIME__.inventory_stock_generation (
 id uuid PRIMARY KEY, active boolean NOT NULL DEFAULT false, enabled boolean NOT NULL DEFAULT false,
 state text NOT NULL CHECK(state IN ('BUILDING','READY','STALE')),
 component_sha256 text NOT NULL CHECK(component_sha256 ~ '^[a-f0-9]{64}$'),
 binding jsonb NOT NULL, mapping_updated_at text, source_epoch text,
 change_seq bigint NOT NULL DEFAULT 0 CHECK(change_seq>=0),
 reconciliation jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX inventory_stock_one_active ON __RUNTIME__.inventory_stock_generation ((true)) WHERE active;
CREATE TABLE __RUNTIME__.inventory_stock_relation (
 generation_id uuid NOT NULL REFERENCES __RUNTIME__.inventory_stock_generation(id), sku_id uuid NOT NULL,
 product_id uuid, origin text NOT NULL, enabled boolean NOT NULL, options jsonb NOT NULL,
 standard_group text, standard_fit text, standard_code text, standard_size text, fit_id text NOT NULL,
 mapping_status text NOT NULL, mapping_revision text, mapping_sha256 text, source_fingerprint text NOT NULL,
 PRIMARY KEY(generation_id,sku_id)
);
CREATE INDEX inventory_stock_relation_product ON __RUNTIME__.inventory_stock_relation(generation_id,product_id,fit_id);
CREATE TABLE __RUNTIME__.inventory_stock_member (
 generation_id uuid NOT NULL REFERENCES __RUNTIME__.inventory_stock_generation(id),
 warehouse_id uuid NOT NULL, sku_id uuid NOT NULL, source_unit text, source_unit_key text,
 product_id uuid, product_key text NOT NULL, product_code text, color_id text,
 cell_key text NOT NULL, cell_tuple jsonb NOT NULL, filter_bucket_key text NOT NULL,
 display_search text NOT NULL, quantity numeric NOT NULL CHECK(quantity=round(quantity,4)), basis_ref jsonb NOT NULL,
 PRIMARY KEY(generation_id,warehouse_id,sku_id),
 FOREIGN KEY(generation_id,sku_id) REFERENCES __RUNTIME__.inventory_stock_relation(generation_id,sku_id)
);
CREATE INDEX inventory_stock_member_cell ON __RUNTIME__.inventory_stock_member(generation_id,cell_key,sku_id);
CREATE TABLE __RUNTIME__.inventory_stock_standard_cell (
 generation_id uuid NOT NULL REFERENCES __RUNTIME__.inventory_stock_generation(id),
 cell_key text NOT NULL, filter_bucket_key text NOT NULL, cell_tuple jsonb NOT NULL,
 warehouse_id uuid NOT NULL, product_id uuid, product_key text NOT NULL, product_code text, color_id text,
 source_unit text, source_unit_key text, standard_group text, standard_fit text, standard_code text, standard_size text,
 unmapped_sku_id uuid, display_search text NOT NULL, quantity numeric NOT NULL CHECK(quantity=round(quantity,4)),
 member_count bigint NOT NULL CHECK(member_count>=0),
 nonzero_count bigint NOT NULL CHECK(nonzero_count BETWEEN 0 AND member_count),
 negative_count bigint NOT NULL CHECK(negative_count BETWEEN 0 AND nonzero_count),
 PRIMARY KEY(generation_id,cell_key,filter_bucket_key)
);
CREATE INDEX inventory_stock_cell_page ON __RUNTIME__.inventory_stock_standard_cell(generation_id,product_key,warehouse_id);
CREATE INDEX inventory_stock_cell_warehouse ON __RUNTIME__.inventory_stock_standard_cell(generation_id,warehouse_id);
REVOKE ALL ON __RUNTIME__.inventory_stock_generation,__RUNTIME__.inventory_stock_relation,
 __RUNTIME__.inventory_stock_member,__RUNTIME__.inventory_stock_standard_cell FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON __RUNTIME__.inventory_stock_generation,__RUNTIME__.inventory_stock_relation,
 __RUNTIME__.inventory_stock_member,__RUNTIME__.inventory_stock_standard_cell TO __APP__;
RESET ROLE;

