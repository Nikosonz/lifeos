// Zod -> Dart model generator. Walks every packages/contracts/src/<module>/schemas.ts
// export whose runtime shape is an object/enum/discriminated-union (skips plain
// scalar schemas like MoneyAmountInput and anything named *Query, since query
// params are built as plain maps client-side, not worth a formal type), and
// emits a typed Dart file per module into mobile/lib/src/generated/.
//
// Why generated instead of hand-written: Dart cannot import the Zod schemas
// directly (see docs/decisions/ for the ADR), so these contracts are the only
// source of truth the mobile client has. Regenerate after any contracts change:
//   npm run generate:dart -w @lifeos/contracts
// No CI job re-runs this yet (see ADR-0013's Consequences and the mobile
// skill's Known Gaps) — a contract change that isn't followed by a manual
// regenerate here won't fail loudly until it breaks the mobile app at
// runtime. Add a CI check that runs this script and diffs the output
// before the mobile client has real users.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as AuthSchemas from "../src/auth/schemas.ts";
import * as FinanceSchemas from "../src/finance/schemas.ts";
import * as TasksSchemas from "../src/tasks/schemas.ts";
import * as HabitsSchemas from "../src/habits/schemas.ts";
import * as CalendarSchemas from "../src/calendar/schemas.ts";
import * as NotificationsSchemas from "../src/notifications/schemas.ts";
import * as ReportsSchemas from "../src/reports/schemas.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../mobile/lib/src/generated");

const MODULES = [
  { key: "auth", file: "auth_models", exports: AuthSchemas },
  { key: "finance", file: "finance_models", exports: FinanceSchemas },
  { key: "tasks", file: "tasks_models", exports: TasksSchemas },
  { key: "habits", file: "habits_models", exports: HabitsSchemas },
  { key: "calendar", file: "calendar_models", exports: CalendarSchemas },
  { key: "notifications", file: "notifications_models", exports: NotificationsSchemas },
  { key: "reports", file: "reports_models", exports: ReportsSchemas },
];

// ---------- pass 1: registry of every generatable top-level export ----------

function isGeneratable(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.def?.type === "string" &&
    ["object", "enum", "union"].includes(value.def.type)
  );
}

/** @type {Map<unknown, {name: string, module: string}>} */
const registry = new Map();

for (const mod of MODULES) {
  for (const [name, value] of Object.entries(mod.exports)) {
    if (name.endsWith("Query")) continue; // query params -> built as plain maps, not generated
    if (isGeneratable(value)) registry.set(value, { name, module: mod.key });
  }
}

// ---------- helpers ----------

function pascal(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Peels ZodOptional/ZodNullable/ZodDefault wrappers, OR-ing nullability. */
function unwrap(schema) {
  let nullable = false;
  let s = schema;
  while (s?.def && ["optional", "nullable", "default"].includes(s.def.type)) {
    if (s.def.type === "optional" || s.def.type === "nullable") nullable = true;
    s = s.def.innerType;
  }
  return { inner: s, nullable };
}

function hasDatetimeFormat(stringSchema) {
  if (stringSchema.def.format === "datetime") return true;
  const checks = stringSchema.def.checks ?? [];
  return checks.some((c) => c?.def?.format === "datetime" || c?._zod?.def?.format === "datetime");
}

function isIntFormat(numberSchema) {
  const checks = numberSchema.def.checks ?? [];
  return checks.some((c) => {
    const fmt = c?.def?.format ?? c?._zod?.def?.format;
    return typeof fmt === "string" && fmt.toLowerCase().includes("int");
  });
}

/**
 * Resolves a Zod schema into a small TypeNode tree, registering any
 * anonymous nested objects it encounters into `auxOut` (module-local
 * auxiliary classes, e.g. DashboardResponse's inline `wallets[]` item).
 */
function resolveType(schema, ctx) {
  const { inner, nullable } = unwrap(schema);

  const reg = registry.get(inner);
  if (reg) {
    if (reg.module !== ctx.currentModule) ctx.externalRefs.add(reg.module);
    return {
      type: { kind: "ref", className: reg.name, isEnum: inner.def.type === "enum" },
      nullable,
    };
  }

  switch (inner.def.type) {
    case "string":
      return { type: { kind: hasDatetimeFormat(inner) ? "datetime" : "string" }, nullable };
    case "number":
      return { type: { kind: isIntFormat(inner) ? "int" : "double" }, nullable };
    case "boolean":
      return { type: { kind: "bool" }, nullable };
    case "unknown":
    case "any":
      return { type: { kind: "dynamic" }, nullable: true };
    case "literal":
      return { type: { kind: "literal", value: inner.def.values[0] }, nullable };
    case "array": {
      const el = resolveType(inner.def.element, ctx);
      return { type: { kind: "array", element: el.type, elementNullable: el.nullable }, nullable };
    }
    case "object": {
      const className = ctx.auxPrefix;
      const fields = buildFields(inner, { ...ctx, auxPrefix: className });
      ctx.auxOut.push({ name: className, fields });
      return { type: { kind: "ref", className, isEnum: false }, nullable };
    }
    default:
      throw new Error(
        `generate-dart-models: unhandled zod type "${inner.def.type}" at ${ctx.auxPrefix}`,
      );
  }
}

function buildFields(objSchema, ctx) {
  const fields = [];
  for (const [fieldName, fieldSchema] of Object.entries(objSchema.def.shape)) {
    const nestedCtx = { ...ctx, auxPrefix: `${ctx.auxPrefix}${pascal(fieldName)}` };
    const { inner } = unwrap(fieldSchema);
    if (inner.def.type === "literal") continue; // discriminator field, implied by the variant class
    // Array-of-anonymous-object gets an "Item" suffix so it doesn't collide
    // with a plain nested-object field of a similar name.
    if (inner.def.type === "array") {
      const { inner: elInner } = unwrap(inner.def.element);
      if (elInner.def.type === "object" && !registry.has(elInner)) {
        nestedCtx.auxPrefix = `${nestedCtx.auxPrefix}Item`;
      }
    }
    const { type, nullable } = resolveType(fieldSchema, nestedCtx);
    fields.push({ jsonName: fieldName, dartName: fieldName, type, nullable });
  }
  return fields;
}

// ---------- Dart rendering ----------

function renderTypeName(node) {
  switch (node.kind) {
    case "string":
      return "String";
    case "datetime":
      return "DateTime";
    case "int":
      return "int";
    case "double":
      return "double";
    case "bool":
      return "bool";
    case "dynamic":
      return "dynamic"; // already nullable; callers must not append "?"
    case "ref":
      return node.className;
    case "array":
      return `List<${renderFullType(node.element, node.elementNullable)}>`;
    default:
      throw new Error(`renderTypeName: unhandled kind ${node.kind}`);
  }
}

// dynamic is implicitly nullable in Dart; a trailing "?" on it is a lint
// warning ("unnecessary_question_mark"), so every nullable-suffix call site
// goes through this instead of appending "?" directly.
function renderFullType(node, nullable) {
  const base = renderTypeName(node);
  return nullable && node.kind !== "dynamic" ? `${base}?` : base;
}

function fromJsonExpr(node, access, nullable) {
  const wrap = (nonNull) => (nullable ? `${access} == null ? null : ${nonNull}` : nonNull);
  switch (node.kind) {
    case "string":
      return nullable ? `${access} as String?` : `${access} as String`;
    case "int":
      return nullable ? `${access} as int?` : `${access} as int`;
    case "double":
      return nullable ? `(${access} as num?)?.toDouble()` : `(${access} as num).toDouble()`;
    case "bool":
      return nullable ? `${access} as bool?` : `${access} as bool`;
    case "dynamic":
      return access;
    case "datetime":
      return wrap(`DateTime.parse(${access} as String)`);
    case "ref":
      if (node.isEnum) return wrap(`${node.className}.values.byName(${access} as String)`);
      return wrap(`${node.className}.fromJson(${access} as Map<String, dynamic>)`);
    case "array": {
      const elExpr = fromJsonExpr(node.element, "e", node.elementNullable);
      const body = `(${access} as List<dynamic>).map((e) => ${elExpr}).toList()`;
      return nullable ? `${access} == null ? null : ${body}` : body;
    }
    default:
      throw new Error(`fromJsonExpr: unhandled kind ${node.kind}`);
  }
}

function toJsonExpr(node, access, nullable) {
  switch (node.kind) {
    case "string":
    case "int":
    case "double":
    case "bool":
    case "dynamic":
      return access;
    case "datetime":
      return nullable ? `${access}?.toIso8601String()` : `${access}.toIso8601String()`;
    case "ref":
      if (node.isEnum) return nullable ? `${access}?.name` : `${access}.name`;
      return nullable ? `${access}?.toJson()` : `${access}.toJson()`;
    case "array": {
      const elExpr = toJsonExpr(node.element, "e", node.elementNullable);
      return `${access}${nullable ? "?" : ""}.map((e) => ${elExpr}).toList()`;
    }
    default:
      throw new Error(`toJsonExpr: unhandled kind ${node.kind}`);
  }
}

function renderClass(name, fields) {
  const ctorParams = fields
    .map((f) => (f.nullable ? `    this.${f.dartName},` : `    required this.${f.dartName},`))
    .join("\n");
  const props = fields
    .map((f) => `  final ${renderFullType(f.type, f.nullable)} ${f.dartName};`)
    .join("\n");
  const fromJsonFields = fields
    .map((f) => `    ${f.dartName}: ${fromJsonExpr(f.type, `json['${f.jsonName}']`, f.nullable)},`)
    .join("\n");
  const toJsonFields = fields
    .map((f) => `    '${f.jsonName}': ${toJsonExpr(f.type, f.dartName, f.nullable)},`)
    .join("\n");

  return `class ${name} {
${props}

  const ${name}({
${ctorParams}
  });

  factory ${name}.fromJson(Map<String, dynamic> json) => ${name}(
${fromJsonFields}
  );

  Map<String, dynamic> toJson() => {
${toJsonFields}
  };
}
`;
}

function renderEnum(name, entries) {
  const members = Object.keys(entries).join(", ");
  return `enum ${name} { ${members} }\n`;
}

function renderUnion(name, discriminator, variants, commonFields) {
  const cases = variants
    .map((v) => `      case '${v.discValue}':\n        return ${v.name}.fromJson(json);`)
    .join("\n");

  // Common fields (shared by every variant, e.g. CalendarItemBase's
  // title/start/end/allDay) become abstract getters on the sealed base, so
  // callers can read them without switching on the variant first — each
  // variant's own field satisfies the getter via @override.
  const commonGetters = commonFields
    .map((f) => `  ${renderFullType(f.type, f.nullable)} get ${f.dartName};`)
    .join("\n");

  return `sealed class ${name} {
  const ${name}();

  factory ${name}.fromJson(Map<String, dynamic> json) {
    switch (json['${discriminator}'] as String) {
${cases}
      default:
        throw FormatException('Unknown ${name} ${discriminator}: \${json['${discriminator}']}');
    }
  }
${commonGetters ? `\n${commonGetters}\n` : ""}
  Map<String, dynamic> toJson();
}
`;
}

function renderVariantClass(
  name,
  discriminatorField,
  discriminatorValue,
  fields,
  parentName,
  overrideNames = new Set(),
) {
  const ctorParams = fields
    .map((f) => (f.nullable ? `    this.${f.dartName},` : `    required this.${f.dartName},`))
    .join("\n");
  const props = fields
    .map(
      (f) =>
        `  ${overrideNames.has(f.dartName) ? "@override\n  " : ""}final ${renderFullType(f.type, f.nullable)} ${f.dartName};`,
    )
    .join("\n");
  const fromJsonFields = fields
    .map((f) => `    ${f.dartName}: ${fromJsonExpr(f.type, `json['${f.jsonName}']`, f.nullable)},`)
    .join("\n");
  const toJsonFields = fields
    .map((f) => `    '${f.jsonName}': ${toJsonExpr(f.type, f.dartName, f.nullable)},`)
    .join("\n");

  return `class ${name} extends ${parentName} {
${props}

  const ${name}({
${ctorParams}
  }) : super();

  factory ${name}.fromJson(Map<String, dynamic> json) => ${name}(
${fromJsonFields}
  );

  @override
  Map<String, dynamic> toJson() => {
    '${discriminatorField}': '${discriminatorValue}',
${toJsonFields}
  };
}
`;
}

// ---------- pass 2: generate per module ----------

fs.mkdirSync(OUT_DIR, { recursive: true });

const HEADER = `// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)
`;

// A union's options are usually ALSO separate named exports in the same
// module (e.g. CalendarEventItemResponse is both its own export and one of
// CalendarItemResponse's discriminated-union members) — those must only be
// emitted once, as a sealed-subtype variant, not again as a plain class.
const unionVariants = new Set();
for (const mod of MODULES) {
  for (const value of Object.values(mod.exports)) {
    if (isGeneratable(value) && value.def.type === "union") {
      for (const opt of value.def.options) unionVariants.add(opt);
    }
  }
}

for (const mod of MODULES) {
  const externalRefs = new Set();
  const parts = [];

  for (const [name, value] of Object.entries(mod.exports)) {
    if (name.endsWith("Query")) continue;
    if (!isGeneratable(value)) continue;
    const reg = registry.get(value);
    if (!reg || reg.module !== mod.key) continue; // safety: only emit each type from its owning module
    if (value.def.type === "object" && unionVariants.has(value)) continue; // emitted by its union instead

    if (value.def.type === "enum") {
      parts.push(renderEnum(name, value.def.entries));
      continue;
    }

    if (value.def.type === "union") {
      const discriminator = value.def.discriminator;

      // Build every variant's fields first (a pre-pass) so common fields
      // shared by ALL variants (e.g. CalendarItemBase's title/start/end/
      // allDay) can be hoisted onto the sealed base as abstract getters —
      // otherwise code holding the base union type couldn't read them
      // without switching on the variant first, unlike a TS discriminated
      // union where shared fields are accessible pre-narrowing.
      const variants = value.def.options.map((opt) => {
        const optReg = registry.get(opt);
        const literalField = Object.entries(opt.def.shape).find(
          ([, s]) => unwrap(s).inner.def.type === "literal",
        );
        const discValue = unwrap(literalField[1]).inner.def.values[0];
        const auxOut = [];
        const fields = buildFields(opt, {
          currentModule: mod.key,
          externalRefs,
          auxOut,
          auxPrefix: optReg.name,
        });
        return { name: optReg.name, discValue, fields, auxOut };
      });

      const fieldKey = (f) => `${f.jsonName}:${renderFullType(f.type, f.nullable)}`;
      const firstKeys = new Set(variants[0].fields.map(fieldKey));
      const commonKeys = [...firstKeys].filter((k) =>
        variants.every((v) => v.fields.some((f) => fieldKey(f) === k)),
      );
      const commonFields = variants[0].fields.filter((f) => commonKeys.includes(fieldKey(f)));

      parts.push(renderUnion(name, discriminator, variants, commonFields));
      for (const v of variants) {
        for (const aux of v.auxOut) parts.push(renderClass(aux.name, aux.fields));
        const overrideNames = new Set(
          v.fields.filter((f) => commonKeys.includes(fieldKey(f))).map((f) => f.dartName),
        );
        parts.push(
          renderVariantClass(v.name, discriminator, v.discValue, v.fields, name, overrideNames),
        );
      }
      continue;
    }

    // plain object
    const auxOut = [];
    const fields = buildFields(value, {
      currentModule: mod.key,
      externalRefs,
      auxOut,
      auxPrefix: name,
    });
    for (const aux of auxOut) parts.push(renderClass(aux.name, aux.fields));
    parts.push(renderClass(name, fields));
  }

  const imports = [...externalRefs]
    .filter((m) => m !== mod.key)
    .map((m) => `import '${MODULES.find((x) => x.key === m).file}.dart';`)
    .sort()
    .join("\n");

  const out = `${HEADER}${imports ? `\n${imports}\n` : ""}\n${parts.join("\n")}`;
  fs.writeFileSync(path.join(OUT_DIR, `${mod.file}.dart`), out, "utf8");
  console.log(`wrote ${mod.file}.dart`);
}

const barrel = `${HEADER}\n${MODULES.map((m) => `export '${m.file}.dart';`).join("\n")}\n`;
fs.writeFileSync(path.join(OUT_DIR, "generated.dart"), barrel, "utf8");
console.log("wrote generated.dart");
