import initSqlJs from 'sql.js';
import localforage from 'localforage';
import { LexiconEntry } from '../types';

const DB_NAME = 'hebrew_lexicon_db';
const STORE_KEY = 'sqlite_binary';

class DatabaseService {
  private db: any = null;
  private SQL: any;
  private isReady: boolean = false;

  constructor() {
    localforage.config({
      name: DB_NAME
    });
  }

  async init() {
    if (this.isReady) return;

    try {
      // Load SQL.js WebAssembly
      // We must point to the WASM file location
      this.SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/${file}`
      });

      // Try to load existing DB from storage
      const savedDb = await localforage.getItem<Uint8Array>(STORE_KEY);

      if (savedDb) {
        this.db = new this.SQL.Database(savedDb);
      } else {
        this.db = new this.SQL.Database();
        this.initSchema();
      }

      this.isReady = true;
    } catch (error) {
      console.error("DatabaseService init error:", error);
      throw error;
    }
  }

  private initSchema() {
    if (!this.db) return;
    const schema = `
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        hebrewWord TEXT,
        hebrewConsonantal TEXT,
        transliteration TEXT,
        partOfSpeech TEXT,
        definition TEXT,
        root TEXT,
        sourcePage TEXT,
        sourceUrl TEXT,
        dateAdded INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_hebrew ON entries(hebrewWord);
      CREATE INDEX IF NOT EXISTS idx_consonantal ON entries(hebrewConsonantal);
    `;
    this.db.run(schema);
    this.save();
  }

  /**
   * Persist the database binary to IndexedDB
   */
  private async save() {
    if (!this.db) return;
    const data = this.db.export();
    await localforage.setItem(STORE_KEY, data);
  }

  addEntries(entries: LexiconEntry[]) {
    if (!this.db) return;
    
    try {
      // Use a transaction for bulk inserts
      this.db.run("BEGIN TRANSACTION");
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO entries (
          id, hebrewWord, hebrewConsonantal, transliteration, partOfSpeech, definition, root, sourcePage, sourceUrl, dateAdded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      for (const entry of entries) {
        stmt.run([
          entry.id,
          entry.hebrewWord,
          entry.hebrewConsonantal || '',
          entry.transliteration || '',
          entry.partOfSpeech,
          entry.definition,
          entry.root || '',
          entry.sourcePage || '',
          entry.sourceUrl || '',
          now
        ]);
      }
      stmt.free();
      this.db.run("COMMIT");
      this.save();
    } catch (e) {
      console.error("Error adding entries:", e);
      try { this.db.run("ROLLBACK"); } catch {}
    }
  }

  deleteEntries(ids: string[]) {
    if (!this.db || ids.length === 0) return;
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      this.db.run(`DELETE FROM entries WHERE id IN (${placeholders})`, ids);
      this.save();
    } catch (e) {
      console.error("Error deleting entries:", e);
    }
  }

  getAllEntries(): LexiconEntry[] {
    if (!this.db) return [];
    
    try {
      const result = this.db.exec("SELECT * FROM entries ORDER BY dateAdded DESC");
      if (result.length === 0) return [];

      return this.mapResults(result[0]);
    } catch (e) {
      console.error("Error fetching all entries:", e);
      return [];
    }
  }

  getEntriesByLetter(letter: string): LexiconEntry[] {
    if (!this.db) return [];
    
    try {
      // LIKE query for both hebrewWord and hebrewConsonantal
      // Using 'letter%' matches words starting with that letter
      const stmt = this.db.prepare(`
        SELECT * FROM entries 
        WHERE hebrewWord LIKE ? OR hebrewConsonantal LIKE ? 
        ORDER BY hebrewWord ASC
      `);
      stmt.bind([`${letter}%`, `${letter}%`]);
      
      const rows: LexiconEntry[] = [];
      while (stmt.step()) {
        rows.push(this.mapRow(stmt.getAsObject()));
      }
      stmt.free();
      return rows;
    } catch (e) {
      console.error("Error fetching entries by letter:", e);
      return [];
    }
  }

  private mapResults(res: any): LexiconEntry[] {
    const columns = res.columns;
    return res.values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj as LexiconEntry;
    });
  }

  private mapRow(row: any): LexiconEntry {
    return row as LexiconEntry;
  }
}

export const dbService = new DatabaseService();