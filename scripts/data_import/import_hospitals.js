const xlsx = require('xlsx');
const { Client } = require('pg');

async function run() {
  const filePath = '/Users/hartmacm4/Documents/Notiflow/docs/월별 매출이익현황.xlsx';
  const workbook = xlsx.readFile(filePath);
  const sheetName = '거래처 마스터';
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  
  await client.connect();

  let insertedCount = 0;

  try {
    const headers = data[0];
    const idIdx = headers.indexOf('거래처ID');
    const nameIdx = headers.indexOf('거래처명');
    const managerIdx = headers.indexOf('담당자');

    console.log("Emptying hospitals table...");
    try {
        await client.query('DELETE FROM hospitals');
    } catch(e) {
        console.log("Delete failed, likely due to foreign keys. Using TRUNCATE CASCADE...");
        await client.query('TRUNCATE TABLE hospitals CASCADE');
    }
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const cId = row[idIdx];
        const cName = row[nameIdx];
        const cManager = row[managerIdx];
        
        if (!cName) continue;
        
        await client.query(
            'INSERT INTO hospitals (id, name, contact_person) VALUES ($1, $2, $3)',
            [cId, cName, cManager || null]
        );
        insertedCount++;
    }
    
    // Reset sequence so future auto-inserts don't have ID conflicts
    await client.query("SELECT setval(pg_get_serial_sequence('hospitals', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM hospitals;");
    
    console.log(`Successfully completed! Cleared existing and inserted ${insertedCount} hospitals.`);
  } catch (err) {
    console.error('Error importing data:', err);
  } finally {
    await client.end();
  }
}
run();
