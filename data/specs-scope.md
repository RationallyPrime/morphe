# Specs Scope — Hyle dmcg Output vs Raw OpenAPI (Composer Grounding)

Scoping the two dmcg-generated Pydantic files so the composer ("What can Sókrates do for
you?") has a clear, cited picture without anyone re-reading 810K of Python.

| File | Size | Lines | Classes | Base | Pydantic |
|---|---|---|---|---|---|
| `generated/humanity_schedule_v2_promoted_openapi_raw.py` | 499K | 12,259 | **746** | `hyle.BaseNode` | v2 |
| `generated/dkplus_openapi_3_0_local_raw.py` | 311K | 8,127 | **261** | `hyle.BaseNode` | v2 |

Both subclass `hyle.BaseNode` (not bare `pydantic.BaseModel`) — these are Hyle nodes, the
"compiled model" artifact we want to show as on-screen evidence.

---

## 1. Inventory per file

### Common to both
- **Pydantic v2** confirmed: `ConfigDict` + `model_config`, PEP 604 unions (`X | None`),
  `from __future__ import annotations`. No v1 idioms.
- **`Annotated` everywhere**: every field is `Annotated[T, Field(...)]` (Humanity 4,824;
  dkPlus 2,701 — i.e. ~1 per field).
- **`model_config = ConfigDict(extra='allow', populate_by_name=True)`** on essentially every
  class (Humanity 617/746, dkPlus 242/261). `extra='allow'` means these are permissive
  passthrough models — fine for grounding, not for strict validation.
- **No enums, no `RootModel`, no root fields** in either file. Enums (where present) are
  expressed as `Literal[...]` (dkPlus only).
- All fields are `Optional` with `= None` defaults (dmcg default behavior; the raw specs
  rarely mark `required`).

### Humanity (`humanity_schedule_v2_promoted_openapi_raw.py`) — NOISY
- Generated from `humanity-schedule-v2.promoted.openapi.json` (header line 2). "promoted" =
  dmcg lifted **inline** request/response body schemas into named classes (the raw spec has
  an **empty `components/schemas`** — see §4). This is the root cause of all the noise below.
- **No `Literal`, no field constraints** (0 `ge/le/min_length/max_length/pattern`). All
  enum/range info lost — the raw spec encodes it only as `example`/`description` prose.
- **`Any`-blowups: 524 bare `Any` fields, 531 `Any | None`, 62 `list[Any]`.** Fields like
  `error`, `conflicts`, `language`, `metadata` collapse to `Any` because inline examples
  were null/empty. (e.g. `Adjust.conflicts: Any | None`, line ~46.)
- **Deeply nested anonymous models** named by JSON path: 445 digit-suffixed dedup classes
  (`Shift2`, `Budget3`), 143 `Field0/FieldN` anon-object classes, 67 deep date/time nests.
  Worst offenders are 60–71 chars, e.g.
  `WuDailyReportDataField605692Field1412838000878708Field878708WorkedUnits` (~line 11200s) —
  numeric path segments (employee/shift IDs from the example payload) baked into class names.
- **alias noise is low** (203 `alias=`) but **`examples=` is everywhere** (4,336) and
  `description=` sparse (348) — documentation value is the example payloads, not prose.
- Net: structurally usable as evidence for **some** Humanity models, but the class graph is
  polluted with hundreds of throwaway example-derived nodes. Hand-pick, don't enumerate.

### dkPlus (`dkplus_openapi_3_0_local_raw.py`) — CLEAN
- Generated from `dkplus_openapi_3_0.local.json` (header line 2).
- **261 classes ↔ 261 `definitions`** in the raw spec: clean **1:1** mapping, named after the
  .NET schema names (`DkCloudDataModelEmployeeEmployeeModel`,
  `DkCloudDataModelSalesInvoiceModel`). Long but deterministic; **0 digit-suffix artifacts**.
- **`Literal` used as enums: 210 occurrences** (e.g. `AccountingCostType: Literal['GLN','Dim']`
  line 485; `BallotType` line 564). Enum semantics preserved.
- **Field constraints present: 55** (`max_length`, `min_length` — e.g. customer `Number`
  max_length=12 min_length=1, line 283; address fields line 645+).
- **0 bare `Any`, 0 `Any|None`, 0 `list[Any]`** — fully typed.
- **Full aliasing: 2,700 `alias=`** (PascalCase API names → snake_case fields) +
  `populate_by_name=True`. **518 `description=`**, only 19 `examples=` — documentation value
  is prose, not example payloads (inverse of Humanity).
- Uses `UUID` and `Base64Str` types. Net: this file is high-quality and directly usable as
  evidence as-is.

---

## 2. Capability-model coverage

All capability-relevant models the 45 automations need are **present** in both files.

### Humanity (found / missing)
| Capability model | Status | Representative class(es) |
|---|---|---|
| Timeclock | found | `Timeclock`, `Timeclock2`, 44 total |
| TimeclockEvent | found | `TimeclockEvent`, `TimeclockEventData` |
| (clock in/out ops) | found | `Clockin`, `Clockout`, `Addclocktime` (74 `Clock*`) |
| Shift | found | `Shift`, `Shift2Cost`, 57 total |
| Schedule | found | `EmployeeSchedules`, `ApproveStaffScheduledItem`, 18 total |
| Employee | found | `Employee`, 47 total |
| Position | found | `Position`, `ManagePosition`, 26 total |
| Location | found | `Location`-family, 27 total |
| Availability | found | `Availability`, 61 total |
| Skill | found | `EmployeeSkills`, `MeSkills`, 12 total |
| Leave / Vacation | found | `Leave`, `DeleteLeaveType` (55); `ApproveStaffVacationItem` |
| Budget | found | `Budget`, `BudgetLocations`, 26 total |
| Cost | found | `AdjustCost`, `Shift2Cost`, `FillCost`, 8 total |
| Payroll | **thin** | only `BusinessPayroll` (1) — Humanity is scheduling-side; payroll lives in dkPlus, as expected |

Missing: nothing capability-critical. Payroll thinness is by design (payroll is dkPlus's job).

### dkPlus (found / missing)
| Capability model | Status | Representative class(es) |
|---|---|---|
| Employee | found | `DkCloudDataModelEmployeeEmployeeModel`, `DkPlusAPIModelsEmployeeEmployeWorkCost` |
| WorkJournal | **named differently** | no literal "WorkJournal"; work/cost is `EmployeeWork` + `EmployeWorkCost` + Inventory `Journal*` |
| CostEntry/CostJournal | found (partial) | `DkPlusAPIModelsEmployeeEmployeWorkCost`; GL `Transaction` carries cost postings |
| Project | found | `DkCloudDataModelProjectProjectModel`, 10 `Project*` |
| ProjectRequest | found | via `*ApprovalRequestModel` / project request models |
| Phase | found | `DkCloudDataModelProjectPhaseModel`, `ProjectPhaseLinkModel` |
| Task | found | `DkCloudDataModelProjectTaskModel`, `ProjectTaskLinkModel` |
| SalesInvoice / Invoice | found | `DkCloudDataModelSalesInvoiceModel`, `InvoiceLineModel`, 25 `Invoice*` |
| GLAccount / GLTransaction / GLJournal | found | `DkCloudDataModelGeneralLedgerAccount`, `...GeneralLedgerTransaction`, `DkPlusAPIModelsGeneralLedgerHead` (8 ledger classes) |
| Product / Inventory / Transfer | found | `...ProductsProductModel` (37 Product*), `DkPlusAPIModelsProductInventory*` (6), `...InventoryTransfer` + `SalesLedgerTransfer` |
| POSOrder | found | `DkPosRestClientModelSalesOrderSalesOrder`, 8 `Pos*` + 12 `Order*` |
| Customer | found | `DkCloudDataModelCustomersCustomerModel`, 21 `Customer*` |
| Payslip / Payroll | found | `DkCloudDataModelPayrollPayslip`, `PayslipLine`, `LicencePayroll` (4) |

Missing: nothing capability-critical. Two naming notes — there is no class literally called
`WorkJournal` (use `EmployeeWork`/`EmployeWorkCost` + GL `Transaction`) and no literal
`GLAccount`/`SalesInvoice` (use `GeneralLedgerAccount` / `SalesInvoiceModel`). All 45
automations' models resolve.

---

## 3. Endpoints — NOT in the dmcg files

Both dmcg files are **component/body models only**. No operations recoverable:
- Humanity: 0 `operationId`, 0 method `def`s, 0 path constants (the 3 `'/...'` hits are image
  URLs in `examples`). The 5 "summary" hits are field names, not OpenAPI summaries.
- dkPlus: 0 `operationId`, 0 paths, 0 methods.
- Only top-level constructs in either file are `import`s and `class`es.

**An endpoint inventory is NOT recoverable from the .py files.** dmcg was run without
`--openapi-scopes paths`, so paths/operationIds/methods/summaries/parameters were dropped.
Endpoints must come from the raw specs (§4).

---

## 4. Raw OpenAPI/Swagger sources

| Spec | Path | Version | Paths | Operations (all w/ operationId) | Schemas |
|---|---|---|---|---|---|
| Humanity | `/home/rationallyprime/projects/humanity-schedule-v2.openapi.json` (2.2 MB) | OpenAPI **3.1.0** | **178** | **264 / 264** | **0 in `components/schemas`** — schemas are **inline** in each operation's request/response `content.schema` |
| dkPlus | `/home/rationallyprime/projects/mcp-registry/dk-mcp/openapi/dkplus_swagger_2_0.json` (435 KB) | **Swagger 2.0** | **253** | **306 / 306** | **261 in `definitions`** (matches dmcg 1:1) |

Notes:
- **Humanity raw carries BOTH** endpoints (178 paths / 264 ops, every op has `operationId`,
  `summary`, `description`, `parameters`, `responses`, `tags`) **AND** models — but the models
  are **inline JSON Schema inside `paths.*.responses.*.content.*.schema`**, not in
  `components/schemas`. So model-per-endpoint is directly readable; there is no shared schema
  registry to `$ref`. dmcg "promoted" those inline schemas into the 746 classes.
- **dkPlus**: the raw OpenAPI **3.0** file named in the dmcg header
  (`dkplus_openapi_3_0.local.json`) is **NOT on disk** anywhere under `/projects` — only the
  Swagger **2.0** source exists. The 2.0 file has both `paths` (253, with `operationId`,
  `summary`) and `definitions` (261, `$ref`-style shared schemas → maps 1:1 to dmcg). The
  3.0 file was almost certainly a transient swagger2openapi conversion fed straight into dmcg.
  **Recommend regenerating/persisting the dkPlus OpenAPI 3.0 JSON** (or just use the 2.0
  source — its `definitions` are clean and complete).

Bottom line: **both raw specs carry endpoints + models. The dmcg .py files carry only
models.** Endpoints exist only in the raw JSON.

---

## 5. Recommendations

### A. Composer DATA SOURCE → use the **raw OpenAPI JSON**, not the dmcg .py
Clear call. The composer must cite **real endpoints** (operationId + method + path + summary)
and that data lives only in the raw specs. The raw JSON is also JSON-native (drops straight
into a SvelteKit `+server`/load or build-time import), carries JSON Schema for models, and is
the right input for **codegen of TS types + Zod** (e.g. `openapi-typescript` for types,
`openapi-zod-client` / `orval --client zod` for Zod). Specifically:
- Humanity → `humanity-schedule-v2.openapi.json` (3.1.0; endpoints in `paths`, models inline
  per-operation — codegen handles inline schemas fine).
- dkPlus → `dkplus_swagger_2_0.json` (convert to OpenAPI 3.0 first for modern codegen, or use
  a 2.0-aware generator; its `definitions` are the clean model set).

Build, at composer build-time, a small **capability→evidence index**: for each of the ~45
automations, store the Humanity op(s) + dkPlus op(s) it touches (operationId/method/path/
summary) plus the model name(s). This is the cited, factual spine.

### B. Keep the dmcg .py as **on-screen EVIDENCE** — yes
Keep both files purely to **display the actual compiled Hyle/Pydantic model** per capability
as proof ("here is the real model Sókrates compiled from dkPlus"). They are not a runtime
dependency of the composer. Two caveats:
- **Prefer dkPlus models for display** — clean names, `Literal` enums, constraints, full
  aliasing, zero `Any`. They look like real engineering on screen.
- **Curate Humanity display models** — show only the hand-picked capability classes
  (`Shift`, `Timeclock`, `Employee`, `Budget`, etc.), never the `Field0…`/digit-suffix
  example-derived junk. As-is, many Humanity classes are `Any`-soup and embarrassing to show.

### C. Should the user REGENERATE dmcg? — **Yes for Humanity, optional for dkPlus** (display-quality only; not required for the composer's data path, which is raw JSON)
Regen materially improves the *evidence* surface for Humanity. Exact flags:

Humanity (the one that needs it):
```
datamodel-codegen \
  --input humanity-schedule-v2.openapi.json \
  --input-file-type openapi \
  --output generated/humanity/                # nested: per-module output dir, not one 12K-line file
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.12 \
  --use-annotated \
  --field-constraints \                        # recover min/max/length from raw spec
  --use-schema-description \                    # prose descriptions over example noise
  --use-default \
  --snake-case-field \
  --collapse-root-models \
  --use-title-as-name \                         # better names from schema `title`, fewer Field0 anon classes
  --use-standard-collections \
  --reuse-model \                               # dedup identical inline schemas → kills Shift2/Budget3 sprawl
  --capitalise-enum-members \
  --enum-field-as-literal all                   # keep Literal-style enums (matches dkPlus)
```
The high-value flags for the noise problem are **`--use-title-as-name`**, **`--reuse-model`**,
**`--collapse-root-models`** (kill anonymous/dedup sprawl) and **`--field-constraints` +
`--use-schema-description`** (recover the constraint/enum/prose info currently lost to `Any`
and `examples`). Output to a **directory** so it's navigable.

dkPlus (already good — regen only to persist a 3.0 source + add paths if you ever want
operations alongside models):
```
datamodel-codegen \
  --input dkplus_openapi_3.0.json \             # first persist the OpenAPI 3.0 conversion of the 2.0 swagger
  --input-file-type openapi \
  --output generated/dkplus/ \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.12 \
  --use-annotated --field-constraints --use-schema-description \
  --use-default --use-standard-collections --collapse-root-models
```

Note on `--openapi-scopes`: dmcg's `--openapi-scopes paths schemas parameters` makes it emit
*parameter/path-tag* models too, but it still does **not** give you a clean operationId→
endpoint table the way parsing the raw JSON does. For the composer's endpoint citations,
**parse the raw JSON directly** rather than relying on dmcg path-scope output.

### TL;DR
- Composer data = **raw OpenAPI JSON** (endpoints + models + TS/Zod codegen). dmcg .py = not
  the data source.
- dmcg .py = **display-only evidence**; dkPlus is showcase-ready, Humanity needs curation.
- Endpoints are **not** in the .py files — only in the raw specs.
- dkPlus 3.0 JSON is **missing on disk** (only Swagger 2.0 exists) — persist it.
- Regenerate **Humanity** dmcg with `--use-title-as-name --reuse-model --collapse-root-models
  --field-constraints --use-schema-description` into a directory to make its models showable.
