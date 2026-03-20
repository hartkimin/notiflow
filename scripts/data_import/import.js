const xlsx = require('xlsx');
const { Client } = require('pg');

async function run() {
  const workbook = xlsx.readFile('/Users/hartmacm4/Documents/Notiflow/docs/매입처 리스트.xls');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  
  await client.connect();

  let insertedCount = 0;
  let updatedCount = 0;

  try {
    // Data starts from index 1 (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const supplierName = row[0];
      const businessNumber = row[1];
      
      if (!supplierName) continue;
      
      const res = await client.query('SELECT id FROM suppliers WHERE name = $1', [supplierName]);
      
      if (res.rows.length === 0) {
        await client.query(
          'INSERT INTO suppliers (name, business_number) VALUES ($1, $2)',
          [supplierName, businessNumber || null]
        );
        insertedCount++;
      } else {
        await client.query(
          'UPDATE suppliers SET business_number = $2 WHERE name = $1',
          [supplierName, businessNumber || null]
        );
        updatedCount++;
      }
    }
    console.log(`Successfully completed! Inserted ${insertedCount} new suppliers, updated ${updatedCount}.`);
  } catch (err) {
    console.error('Error inserting data:', err);
  } finally {
    await client.end();
  }
}

run();
