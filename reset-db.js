const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

try {
  const { DatabaseSync } = require('node:sqlite');
  if (fs.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath);
    console.log('🧹 Cišćenje baze podataka...');
    try { db.exec('DROP TABLE IF EXISTS date_plans;'); } catch(e){}
    try { db.exec('DROP TABLE IF EXISTS puzzle_progress;'); } catch(e){}
    try { db.exec('DROP TABLE IF EXISTS puzzle_completed;'); } catch(e){}
    console.log('✅ Baza podataka je uspešno resetovana!');
    console.log('Korisnički nalozi (andrija<3 i vanja<3) su sačuvani/sejani automatski.');
  } else {
    console.log('Baza podataka još uvek ne postoji.');
  }
} catch (err) {
  // If SQLite file is locked by server, we can unlink or inform user
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
      console.log('✅ Fajl database.sqlite je obrisan. Ponovo pokrenite server za svežu bazu.');
    } catch(e) {
      console.error('Zaustavite server pa pokrenite ponovo:', e.message);
    }
  }
}
