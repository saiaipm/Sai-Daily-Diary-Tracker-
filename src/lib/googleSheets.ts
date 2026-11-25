import { Product, Transaction, Recharge, FamilyMember } from '../types';

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Helper to make Google API requests
async function googleFetch(
  url: string,
  token: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody?.error?.message || response.statusText;
    throw new Error(`Google Sheets API Error: ${message} (Status: ${response.status})`);
  }

  return response.json();
}

/**
 * Creates a brand new Google Sheet in the user's Drive, configured with tabs:
 * "Products", "Transactions", "Recharges", and "Members".
 * Pre-populates default product list, default members, and writes headers.
 */
export async function createSpreadsheet(token: string): Promise<string> {
  const spreadsheet = await googleFetch(SHEETS_BASE_URL, token, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: 'Daily Dairy Tracker',
      },
      sheets: [
        { properties: { title: 'Products' } },
        { properties: { title: 'Transactions' } },
        { properties: { title: 'Recharges' } },
        { properties: { title: 'Members' } },
      ],
    }),
  });

  const spreadsheetId = spreadsheet.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Failed to create spreadsheet (no ID returned)');
  }

  // Pre-populate sheet with headers and default products / members
  await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: 'Products!A1:D1',
          values: [['ProductID', 'ProductName', 'Price', 'Unit']],
        },
        {
          range: 'Transactions!A1:G1',
          values: [
            ['TransactionID', 'Date', 'ProductID', 'Quantity', 'PriceAtTime', 'TotalAmount', 'Member'],
          ],
        },
        {
          range: 'Recharges!A1:D1',
          values: [['RechargeID', 'Date', 'Amount', 'Member']],
        },
        {
          range: 'Members!A1:A4',
          values: [['MemberName'], ['Dad 👨'], ['Mom 👩'], ['Kids 👦']],
        },
        {
          range: 'Products!A2:D7',
          values: [
            ['milk_500ml', 'Milk (Standard)', 28.00, '500ml packet'],
            ['milk_full_1l', 'Milk (Full Cream)', 66.00, '1L packet'],
            ['curd_200g', 'Curd (Cup)', 25.00, '200g tub'],
            ['curd_500g', 'Curd (Pack)', 50.00, '500g packet'],
            ['paneer_200g', 'Paneer', 90.00, '200g pack'],
            ['butter_100g', 'Butter', 55.00, '100g bar'],
          ],
        },
      ],
    }),
  });

  return spreadsheetId;
}

/**
 * Fetches all products, transactions, recharges, and family members from the spreadsheet in a single batch call.
 * Automatically handles upgrading existing spreadsheets with a "Members" sheet if missing.
 */
export async function fetchSpreadsheetData(
  token: string,
  spreadsheetId: string
): Promise<{
  products: Product[];
  transactions: Transaction[];
  recharges: Recharge[];
  members: FamilyMember[];
}> {
  // 1. Fetch spreadsheet info to check if "Members" tab exists
  const spreadsheetInfo = await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, token);
  const sheets = spreadsheetInfo.sheets || [];
  const titles = sheets.map((s: any) => s.properties?.title);

  let hasMembers = titles.includes('Members');
  if (!hasMembers) {
    try {
      // Add sheet "Members"
      await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, token, {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Members',
                },
              },
            },
          ],
        }),
      });

      // Write headers and default members
      await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values:batchUpdate`, token, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: 'Members!A1:A4',
              values: [['MemberName'], ['Dad 👨'], ['Mom 👩'], ['Kids 👦']],
            },
          ],
        }),
      });
      hasMembers = true;
    } catch (err) {
      console.error('Failed to auto-upgrade and create Members tab:', err);
    }
  }

  // Build the batchGet ranges. Let's fetch Transactions column G (7th column) and Recharges column D (4th column)
  const ranges = [
    'Products!A2:D',
    'Transactions!A2:G',
    'Recharges!A2:D',
  ];
  if (hasMembers) {
    ranges.push('Members!A2:A');
  }

  const rangesParam = ranges.map((r) => `ranges=${r}`).join('&');
  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values:batchGet?${rangesParam}`;
  const result = await googleFetch(url, token);

  const valueRanges = result.valueRanges || [];
  const productsVal = valueRanges[0]?.values || [];
  const transactionsVal = valueRanges[1]?.values || [];
  const rechargesVal = valueRanges[2]?.values || [];
  const membersVal = hasMembers ? (valueRanges[3]?.values || []) : [];

  // Parse Products
  const products: Product[] = productsVal.map((row: any) => ({
    ProductID: row[0] || '',
    ProductName: row[1] || '',
    Price: parseFloat(row[2]) || 0,
    Unit: row[3] || '',
  })).filter((p: Product) => p.ProductID !== '');

  // Parse Transactions
  const transactions: Transaction[] = transactionsVal.map((row: any) => ({
    TransactionID: row[0] || '',
    Date: row[1] || '',
    ProductID: row[2] || '',
    Quantity: parseInt(row[3], 10) || 0,
    PriceAtTime: parseFloat(row[4]) || 0,
    TotalAmount: parseFloat(row[5]) || 0,
    Member: row[6] || '', // Column G
  })).filter((t: Transaction) => t.TransactionID !== '');

  // Parse Recharges
  const recharges: Recharge[] = rechargesVal.map((row: any) => ({
    RechargeID: row[0] || '',
    Date: row[1] || '',
    Amount: parseFloat(row[2]) || 0,
    Member: row[3] || '', // Column D
  })).filter((r: Recharge) => r.RechargeID !== '');

  // Parse Members
  const members: FamilyMember[] = membersVal.map((row: any) => ({
    Name: row[0] || '',
  })).filter((m: FamilyMember) => m.Name !== '');

  // Fallback to defaults if no members found
  const finalMembers = members.length > 0 ? members : [
    { Name: 'Dad 👨' },
    { Name: 'Mom 👩' },
    { Name: 'Kids 👦' }
  ];

  return { products, transactions, recharges, members: finalMembers };
}

/**
 * Appends a new list of transactions to the Transactions sheet.
 * They will all share the same TransactionID to represent a multi-item checkout.
 */
export async function appendTransactions(
  token: string,
  spreadsheetId: string,
  items: { Date: string; ProductID: string; Quantity: number; PriceAtTime: number; Member?: string }[]
): Promise<string> {
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  const values = items.map(item => [
    txId,
    item.Date,
    item.ProductID,
    item.Quantity,
    item.PriceAtTime,
    item.Quantity * item.PriceAtTime,
    item.Member || '', // Add Member Column G
  ]);

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Transactions!A:G:append?valueInputOption=USER_ENTERED`;
  await googleFetch(url, token, {
    method: 'POST',
    body: JSON.stringify({
      values,
    }),
  });

  return txId;
}

/**
 * Appends a new recharge record to the Recharges sheet.
 */
export async function appendRecharge(
  token: string,
  spreadsheetId: string,
  recharge: { Date: string; Amount: number; Member?: string }
): Promise<string> {
  const rechargeId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const values = [[rechargeId, recharge.Date, recharge.Amount, recharge.Member || '']];

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Recharges!A:D:append?valueInputOption=USER_ENTERED`;
  await googleFetch(url, token, {
    method: 'POST',
    body: JSON.stringify({
      values,
    }),
  });

  return rechargeId;
}

/**
 * Clears the range and writes the full list of products back to the spreadsheet.
 */
export async function saveProducts(
  token: string,
  spreadsheetId: string,
  products: Product[]
): Promise<void> {
  // First, clear existing values (excluding headers)
  await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values/Products!A2:D:clear`, token, {
    method: 'POST',
  });

  // Then, write updated products
  if (products.length > 0) {
    const values = products.map((p) => [p.ProductID, p.ProductName, p.Price, p.Unit]);
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Products!A2?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  }
}

/**
 * Clears the range and writes the full list of transactions back to the spreadsheet.
 * This is used for deleting or editing existing transactions.
 */
export async function saveTransactions(
  token: string,
  spreadsheetId: string,
  transactions: Transaction[]
): Promise<void> {
  // First, clear existing values (excluding headers)
  await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values/Transactions!A2:G:clear`, token, {
    method: 'POST',
  });

  // Then, write updated transactions
  if (transactions.length > 0) {
    const values = transactions.map((t) => [
      t.TransactionID,
      t.Date,
      t.ProductID,
      t.Quantity,
      t.PriceAtTime,
      t.TotalAmount,
      t.Member || '', // Column G
    ]);
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Transactions!A2?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  }
}

/**
 * Clears the range and writes the full list of recharges back to the spreadsheet.
 */
export async function saveRecharges(
  token: string,
  spreadsheetId: string,
  recharges: Recharge[]
): Promise<void> {
  // First, clear existing values (excluding headers)
  await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values/Recharges!A2:D:clear`, token, {
    method: 'POST',
  });

  // Then, write updated recharges
  if (recharges.length > 0) {
    const values = recharges.map((r) => [r.RechargeID, r.Date, r.Amount, r.Member || '']);
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Recharges!A2?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  }
}

/**
 * Clears the range and writes the full list of members back to the spreadsheet.
 */
export async function saveMembers(
  token: string,
  spreadsheetId: string,
  members: FamilyMember[]
): Promise<void> {
  // First, clear existing values (excluding headers)
  await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values/Members!A2:A:clear`, token, {
    method: 'POST',
  });

  // Then, write updated members
  if (members.length > 0) {
    const values = members.map((m) => [m.Name]);
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Members!A2?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  }
}

/**
 * Verifies if the spreadsheet exists and contains the correct sheet tabs.
 */
export async function verifySpreadsheet(token: string, spreadsheetId: string): Promise<boolean> {
  try {
    const result = await googleFetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, token);
    const sheets = result.sheets || [];
    const titles = sheets.map((s: any) => s.properties?.title);
    return (
      titles.includes('Products') &&
      titles.includes('Transactions') &&
      titles.includes('Recharges')
    );
  } catch (err) {
    console.error('Spreadsheet verification failed:', err);
    return false;
  }
}
