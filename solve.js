// csv-reader-speed-01-run-20261121 · solve.js
// A fast drop-in for make.fun's own csv-reader 1.0.0 (the house baseline): run(input)
// returns exactly csv-reader's {columns, rows, errors} for {text, header} under its
// written broken-row policy, but reads the text with indexOf jumps and zero-copy
// slice views instead of one character at a time.
//
// The policy (identical to the reference, byte for byte in the answers):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it one quote, and each CRLF or lone CR inside it is read as LF;
//     what follows its closing quote is appended as it stands (quote_junk, when the
//     field ends); a quote that never closes is a literal character and the text
//     after it is read again as an unquoted field (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it, padded (short_row) or cut (long_row) to the first record's
//     width; errors are {code, line, row} (+fields/+extra), line the 1-based line
//     its record starts on (every LF, CRLF and lone CR inside a quoted field
//     counted), row its record's index in rows (null for the header), in the order
//     met, a field's quote_junk when the field ends and a record's short_row or
//     long_row when the record ends.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

/** Ended-at markers, mirroring the reference's {COMMA, LINE_BREAK, END}. */
const E_COMMA = 0;
const E_LINE = 1;
const E_END = 2;

export function run(input) {
  const s = String(input.text);
  const header = input.header === true;
  const len = s.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = s.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  /**
   * Reads an unquoted run from `pos` onto an existing `init` value, up to the next
   * comma or line break; a CR not followed by LF is dropped (stray_cr). Returns the
   * value, how it ended and how many characters were added.
   */
  function readUnquoted(init) {
    let v = init;
    let count = 0;
    let p = pos;
    for (;;) {
      let a = s.indexOf(',', p);
      let b = s.indexOf('\n', p);
      let c = s.indexOf('\r', p);
      let i = -1;
      if (a >= 0 && (i < 0 || a < i)) i = a;
      if (b >= 0 && (i < 0 || b < i)) i = b;
      if (c >= 0 && (i < 0 || c < i)) i = c;
      if (i < 0) {
        if (v === '') v = s.slice(p);
        else v += s.slice(p);
        count += len - p;
        pos = len;
        return { value: v, ended: E_END, count };
      }
      const cc = s.charCodeAt(i);
      if (cc === 44) { // ','
        if (p < i) {
          if (v === '') v = s.slice(p, i);
          else v += s.slice(p, i);
          count += i - p;
        }
        pos = i + 1;
        return { value: v, ended: E_COMMA, count };
      }
      if (cc === 10) { // '\n'
        if (p < i) {
          if (v === '') v = s.slice(p, i);
          else v += s.slice(p, i);
          count += i - p;
        }
        pos = i + 1;
        line += 1;
        return { value: v, ended: E_LINE, count };
      }
      // cc === 13 ('\r')
      if (s.charCodeAt(i + 1) === 10) { // CRLF
        if (p < i) {
          if (v === '') v = s.slice(p, i);
          else v += s.slice(p, i);
          count += i - p;
        }
        pos = i + 2;
        line += 1;
        return { value: v, ended: E_LINE, count };
      }
      // A lone CR: dropped.
      if (p < i) {
        if (v === '') v = s.slice(p, i);
        else v += s.slice(p, i);
        count += i - p;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      p = i + 1;
    }
  }

  /**
   * Reads a quoted field whose opening quote is at `pos`.
   */
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let v = '';
    let p = open + 1;
    for (;;) {
      const qi = s.indexOf('"', p);
      if (qi < 0) {
        // The quote never closes: literal character, the rest read again as unquoted.
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        pos = open + 1;
        return readUnquoted('"');
      }
      if (p < qi) {
        const seg = s.slice(p, qi);
        if (seg.indexOf('\n') >= 0 || seg.indexOf('\r') >= 0) {
          // Every LF, CRLF and lone CR inside quotes is one line; each reads as one
          // LF in the value. A CRLF holds both a CR and an LF but counts one line.
          line += (seg.match(/\n/g) || []).length + (seg.match(/\r/g) || []).length - (seg.match(/\r\n/g) || []).length;
          v += seg.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        } else {
          v += seg;
        }
      }
      if (s.charCodeAt(qi + 1) === 34) { // doubled quote: one literal '"'
        v += '"';
        p = qi + 2;
        continue;
      }
      // The field closes at qi.
      pos = qi + 1;
      if (pos >= len) return { value: v, ended: E_END, count: 0 };
      const cc = s.charCodeAt(pos);
      if (cc === 44) {
        pos += 1;
        return { value: v, ended: E_COMMA, count: 0 };
      }
      if (cc === 10) {
        pos += 1;
        line += 1;
        return { value: v, ended: E_LINE, count: 0 };
      }
      if (cc === 13 && s.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value: v, ended: E_LINE, count: 0 };
      }
      // What follows the closing quote is appended as it stands.
      const junk = readUnquoted(v);
      if (junk.count > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return junk;
    }
  }

  while (pos < len) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = s.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && s.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // The fast paths. A record is read in one of three ways, each answering exactly as
    // the field-by-field read below would; anything unusual (a lone CR, a quote that
    // follows its closing quote, a quote that never closes, a quote across a line
    // break) falls through to that read.
    //   1. no quote, no CR: one slice and one split;
    //   2. quotes but no CR and nothing after a closing quote: one walk over the row;
    //   3. everything else: the field-by-field read.
    let fields = null;
    let quoted = false;
    if (s.charCodeAt(pos) !== 34) {
      const nl = s.indexOf('\n', pos);
      const recordEnd = nl < 0 ? len : nl;
      // A CR immediately before the LF is the record's CRLF ending, not a lone CR.
      let contentEnd = recordEnd;
      if (nl >= 0 && contentEnd > pos && s.charCodeAt(contentEnd - 1) === 13) contentEnd -= 1;
      const row = s.slice(pos, contentEnd);
      if (row.indexOf('\r') < 0) {
        if (row.indexOf('"') < 0) {
          // 1. A plain row.
          fields = row.split(',');
          quoted = false;
          pos = nl < 0 ? len : nl + 1;
          if (nl >= 0) line += 1;
        } else {
          // 2. A row with quoted fields, all closed, none followed by junk.
          const out = [];
          const rl = row.length;
          let rp = 0;
          let ok = true;
          let lastQuoted = false;
          while (rp < rl) {
            if (row.charCodeAt(rp) === 34) {
              lastQuoted = true;
              let qi = row.indexOf('"', rp + 1);
              if (qi < 0) {
                ok = false;
                break;
              }
              let doubled = false;
              while (row.charCodeAt(qi + 1) === 34) {
                doubled = true;
                qi = row.indexOf('"', qi + 2);
                if (qi < 0) break;
              }
              if (qi < 0) {
                ok = false;
                break;
              }
              const seg = row.slice(rp + 1, qi);
              out.push(doubled ? seg.replace(/""/g, '"') : seg);
              rp = qi + 1;
              if (rp >= rl) break;
              if (row.charCodeAt(rp) !== 44) {
                ok = false;
                break;
              }
              rp += 1;
            } else {
              lastQuoted = false;
              const ci = row.indexOf(',', rp);
              if (ci < 0) {
                out.push(row.slice(rp));
                rp = rl;
                break;
              }
              out.push(row.slice(rp, ci));
              rp = ci + 1;
            }
          }
          if (ok) {
            if (rp >= rl && rp > 0) {
              // A row that ends on a comma has one more, empty, field.
              if (rl > 0 && row.charCodeAt(rl - 1) === 44) {
                out.push('');
                lastQuoted = false;
              }
            }
            fields = out;
            quoted = lastQuoted;
            pos = nl < 0 ? len : nl + 1;
            if (nl >= 0) line += 1;
          }
        }
      }
    }
    if (fields === null) {
      fields = [];
      for (;;) {
        quoted = s.charCodeAt(pos) === 34;
        const f = quoted ? readQuoted() : readUnquoted('');
        fields.push(f.value);
        if (f.ended !== E_COMMA) break;
      }
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}