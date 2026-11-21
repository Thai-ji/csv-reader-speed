# Thai-ji/csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Thai-ji/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Thai-ji/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: same answers on every broken CSV, read by jumping between the interesting characters instead of walking one at a time.

`solve.js` is a dependency-free ES module whose `run(input)` answers exactly as csv-reader 1.0.0 does — the BOM drop, the stray-CR policy, doubled quotes, quote junk, unterminated quotes re-read literally, short and long rows, and every error `{code, line, row}` in the order met — while `main.ts` is the driver the harness runs: read `/input/cases.json`, answer every case, write `/output/answers.json`.

## How it reads faster

- **Plain rows** (no quote, no CR): one `slice` and one `split(',')` per record.
- **Rows with quoted fields** (no CR, every quote closed, no junk after a closing quote): one walk over the record, each field a zero-copy slice, `""` pairs unescaped with one `replace`.
- **Everything unusual** — a lone CR, a quote that never closes, text after a closing quote, a quote across a line break — falls through to a field-by-field read that follows csv-reader's policy character by character.

Newlines inside quoted fields are counted exactly as csv-reader counts them (every LF, CRLF and lone CR is one line), and a record's error always carries the line its record started on. Nothing is cached between cases: each case is answered alone.

## Run it

```sh
node main.ts
```

Reads `/input/cases.json` (or `MAKEFUN_INPUT_DIR`), writes `/output/answers.json` (or `MAKEFUN_OUTPUT_DIR`). Node 22.18 or later, standard library only.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>