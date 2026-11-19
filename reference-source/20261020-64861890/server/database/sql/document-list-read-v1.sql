SET LOCAL ROLE __RUNTIME_OWNER__;
CREATE TABLE __RUNTIME__.document_list_generation (
 id uuid PRIMARY KEY,
 document_type text NOT NULL CHECK(document_type IN ('SALE','TRANSFER')),
 state text NOT NULL CHECK(state IN ('BUILDING','READY','STALE')),
 active boolean NOT NULL DEFAULT false,
 source_epoch text NOT NULL CHECK(source_epoch ~ '^[a-f0-9]{64}$'),
 projector_sha256 text NOT NULL CHECK(projector_sha256 ~ '^[a-f0-9]{64}$'),
 change_seq bigint NOT NULL DEFAULT 0 CHECK(change_seq>=0),
 reconciliation jsonb NOT NULL CHECK(jsonb_typeof(reconciliation)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,document_type),CHECK(NOT active OR state='READY')
);
CREATE UNIQUE INDEX document_list_one_active ON __RUNTIME__.document_list_generation(document_type) WHERE active;
CREATE UNIQUE INDEX document_list_one_building ON __RUNTIME__.document_list_generation(document_type) WHERE state='BUILDING';
CREATE TABLE __RUNTIME__.document_list_summary (
 generation_id uuid NOT NULL,document_id uuid NOT NULL REFERENCES __RUNTIME__.document(id),
 document_type text NOT NULL,document_version integer NOT NULL CHECK(document_version>0),revision integer NOT NULL CHECK(revision>0),
 basis_sha256 text NOT NULL CHECK(basis_sha256 ~ '^[a-f0-9]{64}$'),
 source_read_valid boolean NOT NULL,scope_proven boolean NOT NULL,identity_proven boolean NOT NULL,
 source_kind text NOT NULL,source_body_sha256 text CHECK(source_body_sha256 ~ '^[a-f0-9]{64}$'),legacy_readonly boolean NOT NULL,
 number text NOT NULL,note text NOT NULL DEFAULT '',customer_id text,salesperson_id text,business_type text,
 status text NOT NULL CHECK(status IN ('DRAFT','UNAUDITED','APPROVED','DELETED')),
 business_day date,created_at timestamptz,updated_at timestamptz,
 hall_id uuid,warehouse_id uuid,from_warehouse_id uuid,to_warehouse_id uuid,
 creator_hall_id uuid,creator_account_id uuid,creator_role text CHECK(creator_role IN ('ADMIN','WAREHOUSE','SALESPERSON')),creation_proven boolean NOT NULL,
 quantity numeric CHECK(quantity=round(quantity,4)),gift_quantity numeric CHECK(gift_quantity=round(gift_quantity,4)),
 incoming_quantity numeric CHECK(incoming_quantity=round(incoming_quantity,4)),outgoing_quantity numeric CHECK(outgoing_quantity=round(outgoing_quantity,4)),
 gross numeric,adjustment numeric,due numeric,product_count integer CHECK(product_count>=0),
 public_payload jsonb NOT NULL CHECK(jsonb_typeof(public_payload)='object'),
 PRIMARY KEY(generation_id,document_id),
 FOREIGN KEY(generation_id,document_type) REFERENCES __RUNTIME__.document_list_generation(id,document_type)
);
CREATE INDEX document_list_sale_order ON __RUNTIME__.document_list_summary(generation_id,business_day DESC NULLS LAST,created_at DESC,document_id) WHERE document_type='SALE';
CREATE INDEX document_list_sale_hall ON __RUNTIME__.document_list_summary(generation_id,hall_id,business_day DESC NULLS LAST,document_id) WHERE document_type='SALE';
CREATE INDEX document_list_transfer_order ON __RUNTIME__.document_list_summary(generation_id,updated_at DESC NULLS LAST,number,document_id) WHERE document_type='TRANSFER';
CREATE INDEX document_list_number ON __RUNTIME__.document_list_summary(generation_id,number,document_id);
CREATE TABLE __RUNTIME__.document_list_warehouse (
 generation_id uuid NOT NULL,document_id uuid NOT NULL,warehouse_id uuid NOT NULL,
 PRIMARY KEY(generation_id,document_id,warehouse_id),
 FOREIGN KEY(generation_id,document_id) REFERENCES __RUNTIME__.document_list_summary(generation_id,document_id)
);
CREATE INDEX document_list_warehouse_reverse ON __RUNTIME__.document_list_warehouse(generation_id,warehouse_id,document_id);
CREATE TABLE __RUNTIME__.document_list_product (
 generation_id uuid NOT NULL,document_id uuid NOT NULL,product_key text NOT NULL,product_id uuid,
 first_ordinal integer NOT NULL CHECK(first_ordinal>0),quantity numeric CHECK(quantity=round(quantity,4)),
 gift_quantity numeric CHECK(gift_quantity=round(gift_quantity,4)),unknown_count integer NOT NULL CHECK(unknown_count>=0),
 source_category_key text,presentation_basis jsonb NOT NULL CHECK(jsonb_typeof(presentation_basis)='object'),
 PRIMARY KEY(generation_id,document_id,product_key),
 FOREIGN KEY(generation_id,document_id) REFERENCES __RUNTIME__.document_list_summary(generation_id,document_id)
);
CREATE INDEX document_list_product_order ON __RUNTIME__.document_list_product(generation_id,document_id,first_ordinal,product_key);
CREATE INDEX document_list_product_reverse ON __RUNTIME__.document_list_product(product_id,generation_id,document_id);
CREATE TABLE __RUNTIME__.document_list_rebuild_dirty (
 generation_id uuid NOT NULL REFERENCES __RUNTIME__.document_list_generation(id),document_id uuid NOT NULL,
 dirty_revision bigint NOT NULL CHECK(dirty_revision>0),last_document_version integer NOT NULL CHECK(last_document_version>0),
 PRIMARY KEY(generation_id,document_id)
);

-- Commit-ordered transaction rows, never a sequence watermark. Capture also
-- private/import writers; maintained mode separately requires their refresh.
CREATE FUNCTION __RUNTIME__.document_list_capture_dirty() RETURNS trigger LANGUAGE plpgsql AS $capture$
BEGIN
 INSERT INTO __RUNTIME__.document_list_rebuild_dirty(generation_id,document_id,dirty_revision,last_document_version)
 SELECT id,NEW.id,1,NEW.version FROM __RUNTIME__.document_list_generation
 WHERE document_type=NEW.document_type AND state='BUILDING'
 ON CONFLICT(generation_id,document_id) DO UPDATE
 SET dirty_revision=__RUNTIME__.document_list_rebuild_dirty.dirty_revision+1,last_document_version=excluded.last_document_version;
 RETURN NEW;
END $capture$;
CREATE TRIGGER document_list_dirty AFTER INSERT OR UPDATE ON __RUNTIME__.document
 FOR EACH ROW EXECUTE FUNCTION __RUNTIME__.document_list_capture_dirty();

-- An upgraded writer must publish its trusted summary before COMMIT. A private
-- writer without the hook fails closed while an active generation exists.
CREATE FUNCTION __RUNTIME__.document_list_require_current() RETURNS trigger LANGUAGE plpgsql AS $current$
BEGIN
 IF EXISTS(SELECT 1 FROM __RUNTIME__.document d JOIN __RUNTIME__.document_list_generation g ON g.document_type=d.document_type AND g.active
   LEFT JOIN __RUNTIME__.revision r ON r.document_id=d.id AND r.revision=d.current_revision
   LEFT JOIN __RUNTIME__.document_list_summary s ON s.generation_id=g.id AND s.document_id=d.id
   WHERE d.id=NEW.id AND (s.document_id IS NULL OR s.document_version<>d.version OR s.revision<>d.current_revision
     OR NOT(s.source_read_valid AND s.scope_proven AND s.identity_proven)
     OR s.basis_sha256 IS DISTINCT FROM encode(sha256(convert_to(jsonb_build_array(d.id,d.document_type,d.version,d.current_revision,r.body,d.source_identity,
       d.number,d.status,d.business_day,d.created_at,d.updated_at,d.baseline_was_included,d.transfer_creator_hall_id,d.transfer_creator_account_id,d.transfer_creator_role,d.original_auditor,d.original_audited_at,g.projector_sha256)::text,'UTF8')),'hex')))
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='DOCUMENT_LIST_REFRESH_REQUIRED';END IF;
 RETURN NULL;
END $current$;
CREATE CONSTRAINT TRIGGER document_list_current AFTER INSERT OR UPDATE ON __RUNTIME__.document
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION __RUNTIME__.document_list_require_current();

REVOKE ALL ON __RUNTIME__.document_list_generation,__RUNTIME__.document_list_summary,__RUNTIME__.document_list_warehouse,
 __RUNTIME__.document_list_product,__RUNTIME__.document_list_rebuild_dirty FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON __RUNTIME__.document_list_generation,__RUNTIME__.document_list_summary,
 __RUNTIME__.document_list_warehouse,__RUNTIME__.document_list_product,__RUNTIME__.document_list_rebuild_dirty TO __APP__;
REVOKE ALL ON FUNCTION __RUNTIME__.document_list_capture_dirty(),__RUNTIME__.document_list_require_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION __RUNTIME__.document_list_capture_dirty(),__RUNTIME__.document_list_require_current() TO __APP__;
RESET ROLE;
