const { Client } = require('pg');
const xlsx = require('xlsx');

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const filePath = '/Users/hartmacm4/Documents/Notiflow/docs/월별 매출이익현황.xlsx';

async function run() {
  const client = new Client(DB_URL);
  await client.connect();
  
  const wb = xlsx.readFile(filePath);
  const data = xlsx.utils.sheet_to_json(wb.Sheets['거래내역']);
  
  // Get hospitals mapping
  const hRes = await client.query('SELECT id, name FROM hospitals');
  const hospitalMap = {};
  for(const h of hRes.rows) hospitalMap[h.name.trim()] = h.id;

  // Get products mapping (my_drugs)
  const pRes = await client.query('SELECT id, item_name as name FROM my_drugs');
  const productMap = {};
  // match loosely by name if needed, but exact trim first
  for(const p of pRes.rows) productMap[p.name.trim()] = p.id;

  // Filter 1월, 2월
  const targetRows = data.filter(r => r['월'] === '1월' || r['월'] === '2월');
  
  // Group by (월, 거래처명, 담당자) => create an order
  const ordersMap = {}; 
  
  for(const r of targetRows) {
    const monthStr = r['월']; 
    const hospitalName = r['거래처명']?.trim();
    const repName = r['담당자']?.trim();
    
    if(!hospitalName) continue;
    
    const key = `${monthStr}|${hospitalName}|${repName}`;
    if(!ordersMap[key]) {
      ordersMap[key] = {
        month: monthStr,
        hospitalName,
        repName,
        items: []
      };
    }
    ordersMap[key].items.push(r);
  }
  
  console.log(`Found ${Object.keys(ordersMap).length} grouped orders to insert from ${targetRows.length} invoice rows.`);

  let orderNumSeq = 1;

  await client.query('BEGIN');
  try {
    for(const key of Object.values(ordersMap)) {
       const monthNum = key.month.replace('월', '').padStart(2, '0');
       // make it a real date in the past
       const orderDate = `2024-${monthNum}-15 10:00:00`;
       
       let hospital_id = hospitalMap[key.hospitalName];
       if(!hospital_id) {
         console.log(`Inserting missing hospital: ${key.hospitalName}`);
         const hResInsert = await client.query('INSERT INTO hospitals (name, hospital_type, is_active) VALUES ($1, $2, true) RETURNING id', [key.hospitalName, 'clinic']);
         hospital_id = hResInsert.rows[0].id;
         hospitalMap[key.hospitalName] = hospital_id;
       }
       
       // Calc amounts
       let supply_amount = 0;
       let total_items = 0;
       key.items.forEach(i => {
         const qty = parseInt(i['수량']) || 0;
         const sp = parseFloat(i['매출가']) || 0;
         supply_amount += sp;
         total_items += qty;
       });
       
       const tax_amount = Math.round(supply_amount * 0.1);
       const total_amount = supply_amount + tax_amount;
       
       const orderNumber = `ORD-2024${monthNum}-${String(orderNumSeq++).padStart(4, '0')}`;
       
       // insert order
       const insertOrderQuery = `
         INSERT INTO orders (order_number, order_date, hospital_id, status, supply_amount, tax_amount, total_amount, total_items)
         VALUES ($1, $2, $3, 'delivered', $4, $5, $6, $7)
         RETURNING id;
       `;
       const oResult = await client.query(insertOrderQuery, [
         orderNumber, orderDate, hospital_id, supply_amount, tax_amount, total_amount, total_items
       ]);
       const order_id = oResult.rows[0].id;
       
       // insert items
       for(const i of key.items) {
          const rawName = i['품목명(규격)']?.trim() || 'Unknown';
          // basic find logic if precise map fails
          let pId = productMap[rawName] || null;
          if(!pId) {
             // fallback logic to find closely
             const closeP = Object.keys(productMap).find(k => rawName.includes(k) || k.includes(rawName));
             if (closeP) pId = productMap[closeP];
          }

          const qty = parseInt(i['수량']) || 0;
          const uPrice = parseFloat(i['매출단가']) || 0;
          const pPrice = parseFloat(i['매입단가']) || 0;
          const line_total = parseFloat(i['매출가']) || 0;
          
          await client.query(`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_type, unit_price, purchase_price, line_total, sales_rep)
            VALUES ($1, $2, $3, $4, 'EA', $5, $6, $7, $8)
          `, [
             order_id, pId, rawName, qty, uPrice, pPrice, line_total, key.repName
          ]);
       }
    }
    
    await client.query('COMMIT');
    console.log('Successfully seeded 1월/2월 order data.');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Error seeding data:', e);
  } finally {
    await client.end();
  }
}

run();
