/**
 * Prints the offline matching evaluation.
 *   npx tsx evals/matching/run.ts          # Markdown summary
 *   npx tsx evals/matching/run.ts --json   # full report as JSON
 */
import { readFileSync } from "node:fs";
import { evaluate, formatReport, type Dataset } from "./evaluate";

const data = JSON.parse(readFileSync(new URL("./dataset.json", import.meta.url), "utf8")) as Dataset;
const report = evaluate(data);
console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
