import React, { useState, useCallback, useEffect } from 'react';
import FileUploader from './components/FileUploader';
import ResultsDisplay from './components/ResultsDisplay';
import ProcessingQueue from './components/ProcessingQueue';
import AlphabetFilter from './components/AlphabetFilter';
import { ProcessedPage, LexiconEntry } from './types';
import { extractEntriesFromImage } from './services/geminiService';
import { dbService } from './services/db';

const App: React.FC = () => {
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [dbEntries, setDbEntries] = useState<LexiconEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Initialize DB on mount
  useEffect(() => {
    const initDb = async () => {
      try {
        await dbService.init();
        setIsDbReady(true);
        // Load initial data
        refreshEntries(null);
      } catch (e: any) {
        console.error("Failed to initialize database", e);
        setDbError(e.message || "Failed to load database. Please refresh the page.");
      }
    };
    initDb();
  }, []);

  const refreshEntries = useCallback((letter: string | null) => {
    if (letter) {
      setDbEntries(dbService.getEntriesByLetter(letter));
    } else {
      setDbEntries(dbService.getAllEntries());
    }
  }, []);

  // Update entries when letter filter changes
  useEffect(() => {
    if (isDbReady) {
      refreshEntries(selectedLetter);
    }
  }, [selectedLetter, isDbReady, refreshEntries]);

  const handleDeleteEntries = useCallback((idsToDelete: string[]) => {
    dbService.deleteEntries(idsToDelete);
    refreshEntries(selectedLetter);
  }, [selectedLetter, refreshEntries]);

  const handleLetterSelect = (letter: string | null) => {
    setSelectedLetter(letter);
  };

  const handleFilesSelected = useCallback(async (files: File[]) => {
    // Create initial page objects for status tracking
    const newPages: ProcessedPage[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      fileName: file.name,
      imageUrl: URL.createObjectURL(file),
      status: 'pending',
      entries: []
    }));

    setPages(prev => [...prev, ...newPages]);
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pageId = newPages[i].id;
      const pageUrl = newPages[i].imageUrl;

      setPages(prev => prev.map(p => 
        p.id === pageId ? { ...p, status: 'processing' } : p
      ));

      try {
        const extractedEntries = await extractEntriesFromImage(file);
        
        // Enrich entries with source metadata
        const enrichedEntries: LexiconEntry[] = extractedEntries.map(entry => ({
          ...entry,
          sourcePage: file.name,
          sourceUrl: pageUrl
        }));

        // Insert into Database
        dbService.addEntries(enrichedEntries);
        
        // Update local status
        setPages(prev => prev.map(p => 
          p.id === pageId ? { 
            ...p, 
            status: 'completed', 
            entries: enrichedEntries 
          } : p
        ));

        // Refresh the view if the new entries are relevant to current filter
        // Simplifying to just refresh view
        refreshEntries(selectedLetter);

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429');
        
        setPages(prev => {
          let updatedPages = prev.map((p): ProcessedPage => 
            p.id === pageId ? { 
              ...p, 
              status: 'error', 
              error: errorMessage 
            } : p
          );

          if (isQuotaError) {
             updatedPages = updatedPages.map((p): ProcessedPage => 
               p.status === 'pending' ? {
                 ...p,
                 status: 'error',
                 error: 'Cancelled: API Quota Exceeded'
               } : p
             );
          }
          return updatedPages;
        });

        if (isQuotaError) break;
      }
    }
    
    setIsProcessing(false);
  }, [selectedLetter, refreshEntries]);

  if (dbError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-red-600 p-4">
        <div className="text-center max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2 className="text-xl font-bold mb-2">Error Loading Database</h2>
          <p>{dbError}</p>
        </div>
      </div>
    );
  }

  if (!isDbReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Initializing Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between flex-shrink-0 z-20 relative">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Hebrew Lexicon Scanner</h1>
            <p className="text-xs text-slate-500">SQLite Database Active</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        {/* Left Sidebar: Upload & Status */}
        <div className="w-80 flex flex-col gap-6 flex-shrink-0 p-6 border-r border-slate-200 bg-slate-50 z-10">
          <FileUploader 
            onFilesSelected={handleFilesSelected} 
            isProcessing={isProcessing} 
          />
          <ProcessingQueue pages={pages} />
        </div>

        {/* Right Content: Alphabet & Results */}
        <div className="flex-1 min-w-0 flex flex-col">
          <AlphabetFilter 
            selectedLetter={selectedLetter} 
            onLetterSelect={handleLetterSelect} 
          />
          
          <div className="flex-1 overflow-hidden">
            <ResultsDisplay 
              entries={dbEntries} 
              onDeleteEntries={handleDeleteEntries}
              filterTitle={selectedLetter ? `Entries starting with ${selectedLetter}` : 'All Entries'}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;