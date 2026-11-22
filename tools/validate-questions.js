#!/usr/bin/env node
/*
 * Validador do banco de questões.
 * Uso: node tools/validate-questions.js
 * Verifica estrutura, IDs únicos, 4 alternativas distintas, índice de resposta,
 * códigos de bandeira e mínimo de perguntas por categoria.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "questions.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const MIN_PER_CATEGORY = 15;
const errors = [];

const catIds = new Set(data.categories.map((c) => c.id));
const ids = new Set();
const texts = new Set();
const perCat = {};
const perSub = {};

data.questions.forEach((q, n) => {
  const where = `#${n} (${q.id || "sem id"})`;
  if (!q.id) errors.push(`${where}: falta 'id'`);
  else if (ids.has(q.id)) errors.push(`${where}: id duplicado`);
  ids.add(q.id);

  if (!catIds.has(q.category)) errors.push(`${where}: categoria desconhecida '${q.category}'`);
  if (typeof q.question !== "string" || !q.question.trim()) errors.push(`${where}: enunciado vazio`);

  const key = `${q.question}|${q.flag || ""}`;
  if (texts.has(key)) errors.push(`${where}: enunciado duplicado`);
  texts.add(key);

  if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${where}: precisa de exatamente 4 alternativas`);
  else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) errors.push(`${where}: alternativas repetidas`);

  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push(`${where}: 'answer' deve ser 0 a 3`);
  if (!q.explanation) errors.push(`${where}: falta 'explanation'`);

  if (q.flag !== undefined && !/^[a-z]{2}$/.test(q.flag)) errors.push(`${where}: código de bandeira inválido '${q.flag}'`);
  if (q.subtype === "bandeiras" && !q.flag) errors.push(`${where}: pergunta de bandeira sem 'flag'`);

  perCat[q.category] = (perCat[q.category] || 0) + 1;
  if (q.subtype) perSub[q.subtype] = (perSub[q.subtype] || 0) + 1;
});

catIds.forEach((id) => {
  if ((perCat[id] || 0) < MIN_PER_CATEGORY) errors.push(`categoria '${id}' tem só ${perCat[id] || 0} perguntas (mínimo ${MIN_PER_CATEGORY})`);
});

console.log(`Total: ${data.questions.length} perguntas`);
Object.entries(perCat).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} ${v}`));
Object.entries(perSub).forEach(([k, v]) => console.log(`    └ ${k.padEnd(10)} ${v}`));

if (errors.length) {
  console.error(`\n${errors.length} problema(s):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("\n✔ Banco de questões válido.");
