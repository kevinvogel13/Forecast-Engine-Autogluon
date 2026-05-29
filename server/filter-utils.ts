// Pure filter logic for the preview/transform endpoints.
//
// Extracted verbatim from routes.ts so it can be unit-tested without importing
// the whole server (DB, storage, multer …). Behaviour is unchanged.

export function testRowCondition(cellValue: any, operator: string, value: any): boolean {
  switch (operator) {
    case 'eq': { const _nc = parseFloat(cellValue), _nv = parseFloat(value); return (!isNaN(_nc) && !isNaN(_nv)) ? _nc === _nv : String(cellValue) === String(value); }
    case 'neq': { const _nc2 = parseFloat(cellValue), _nv2 = parseFloat(value); return (!isNaN(_nc2) && !isNaN(_nv2)) ? _nc2 !== _nv2 : String(cellValue) !== String(value); }
    case 'gt': return parseFloat(cellValue) > parseFloat(value);
    case 'gte': return parseFloat(cellValue) >= parseFloat(value);
    case 'lt': return parseFloat(cellValue) < parseFloat(value);
    case 'lte': return parseFloat(cellValue) <= parseFloat(value);
    case 'contains': return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_contains': return !String(cellValue).toLowerCase().includes(String(value).toLowerCase());
    case 'starts_with': return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'ends_with': return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
    case 'isin': { const inVals = Array.isArray(value) ? value : [value]; return inVals.map(String).includes(String(cellValue)); }
    case 'notin': { const notInVals = Array.isArray(value) ? value : [value]; return !notInVals.map(String).includes(String(cellValue)); }
    case 'isnull': return cellValue === null || cellValue === undefined || cellValue === '' || cellValue === 'null';
    case 'notnull': return cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== 'null';
    default: return true;
  }
}

/**
 * Apply a filter transform to an array of records.
 * Supports two formats:
 *   - Single condition: { column, operator, value }
 *   - Multi-condition:  { conditions: [{ column, op, value, logic }] }
 */
export function applyFilterTransform(records: any[], filterData: any): any[] {
  if (filterData.conditions && Array.isArray(filterData.conditions)) {
    return records.filter((row: any) => {
      let result: boolean | null = null;
      for (const cond of filterData.conditions) {
        if (!cond.column) continue;
        const pass = testRowCondition(row[cond.column], cond.op || cond.operator || 'eq', cond.values ?? cond.value);
        if (result === null) {
          result = pass;
        } else if (cond.logic === 'OR') {
          result = result || pass;
        } else {
          result = result && pass;
        }
      }
      return result !== false;
    });
  }
  const { column, operator, value } = filterData;
  if (!column || !operator) return records;
  return records.filter((row: any) => testRowCondition(row[column], operator, value));
}
