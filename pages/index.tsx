import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Memory, getAllMemories, saveMemory, generateId, blobToDataUrl, encryptText, decryptText, getSettings } from '../utils/db';
import { useTheme } from '../contexts/ThemeContext';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory?: Memory;
  onSave: (memory: Memory) => void;
}

function MemoryModal({ isOpen, onClose, memory, onSave }: MemoryModalProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [textMemory, setTextMemory] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (memory) {
      setPhotoPreview(memory.photoUrl);
      setTextMemory(memory.textMemory || '');
      setUnlockDate(memory.unlockDate || '');
      setAudioBlob(memory.audioBlob || null);
      setHasAudio(!!memory.audioBlob);
    } else {
      // Reset form
      setPhotoFile(null);
      setPhotoPreview('');
      setTextMemory('');
      setUnlockDate('');
      setAudioBlob(null);
      setHasAudio(false);
    }
  }, [memory, isOpen]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const preview = await blobToDataUrl(file);
      setPhotoPreview(preview);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setHasAudio(true);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const deleteAudio = () => {
    setAudioBlob(null);
    setHasAudio(false);
  };

  const handleSave = async () => {
    if (!photoFile && !memory) {
      alert('Please select a photo');
      return;
    }

    try {
      const settings = await getSettings();
      const now = new Date().toISOString();
      
      let finalTextMemory = textMemory;
      if (settings.encryptionEnabled && textMemory) {
        finalTextMemory = encryptText(textMemory, settings.encryptionKey);
      }

      const newMemory: Memory = {
        id: memory?.id || generateId(),
        photoUrl: photoPreview,
        photoBlob: photoFile || memory!.photoBlob,
        textMemory: finalTextMemory,
        audioBlob: audioBlob ?? undefined,
        unlockDate: unlockDate || undefined,
        isEncrypted: settings.encryptionEnabled,
        createdAt: memory?.createdAt || now,
        updatedAt: now,
      };

      await saveMemory(newMemory);
      onSave(newMemory);
      onClose();
    } catch (error) {
      console.error('Failed to save memory:', error);
      alert('Failed to save memory');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold dark:text-white">
              {memory ? 'Edit Memory' : 'Add New Memory'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          {/* Photo Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-white">
              Photo
            </label>
            {!photoPreview ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  >
                    Choose Photo
                  </button>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                    Or take a new photo
                  </p>
                </div>
              </>
            ) : (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Memory photo"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setPhotoPreview('');
                    setPhotoFile(null);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* Text Memory */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-white">
              Text Memory
            </label>
            <textarea
              value={textMemory}
              onChange={(e) => setTextMemory(e.target.value)}
              placeholder="Write your memory here..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={4}
            />
          </div>

          {/* Voice Memory */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-white">
              Voice Memory
            </label>
            <div className="flex items-center space-x-2">
              {!isRecording && !hasAudio && (
                <button
                  onClick={startRecording}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
                >
                  🎤 Record
                </button>
              )}
              
              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center animate-pulse"
                >
                  ⏹️ Stop
                </button>
              )}
              
              {hasAudio && (
                <>
                  <button
                    onClick={playAudio}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center"
                  >
                    ▶️ Play
                  </button>
                  <button
                    onClick={deleteAudio}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Time Capsule */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 dark:text-white">
              Time Capsule (Optional)
            </label>
            <input
              type="date"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Memory will be locked until this date
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
            >
              Save Memory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ memory, onClick, onDelete }: { 
  memory: Memory; 
  onClick: () => void;
  onDelete: () => void;
}) {
  const [settings, setSettings] = useState<any>(null);
  
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const isLocked = memory.unlockDate && new Date(memory.unlockDate) > new Date();
  
  const getTextPreview = () => {
    if (!memory.textMemory) return '';
    
    if (isLocked) return '🔒 Locked until ' + new Date(memory.unlockDate!).toLocaleDateString();
    
    if (memory.isEncrypted && settings) {
      try {
        const decrypted = decryptText(memory.textMemory, settings.encryptionKey);
        return decrypted.slice(0, 50) + (decrypted.length > 50 ? '...' : '');
      } catch {
        return '🔒 Encrypted';
      }
    }
    
    return memory.textMemory.slice(0, 50) + (memory.textMemory.length > 50 ? '...' : '');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="relative">
        <img
          src={memory.photoUrl}
          alt="Memory"
          className="w-full h-48 object-cover cursor-pointer"
          onClick={onClick}
        />
        {memory.audioBlob && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs">
            🎤
          </div>
        )}
        {isLocked && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs">
            🔒
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute bottom-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
        >
          🗑️
        </button>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {new Date(memory.createdAt).toLocaleDateString()}
        </div>
        {memory.textMemory && (
          <p className="text-gray-800 dark:text-gray-200 text-sm">
            {getTextPreview()}
          </p>
        )}
      </div>
    </div>
  );
}

function ViewMemoryModal({ memory, isOpen, onClose }: {
  memory: Memory | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<any>(null);
  
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!isOpen || !memory) return null;

  const isLocked = memory.unlockDate && new Date(memory.unlockDate) > new Date();
  
  const getDisplayText = () => {
    if (!memory.textMemory) return '';
    
    if (isLocked) return null;
    
    if (memory.isEncrypted && settings) {
      try {
        return decryptText(memory.textMemory, settings.encryptionKey);
      } catch {
        return '🔒 Unable to decrypt';
      }
    }
    
    return memory.textMemory;
  };

  const playAudio = () => {
    if (memory.audioBlob && !isLocked) {
      const audioUrl = URL.createObjectURL(memory.audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="relative">
          <img
            src={memory.photoUrl}
            alt="Memory"
            className="w-full h-64 object-cover rounded-t-lg"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70"
          >
            &times;
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Created: {new Date(memory.createdAt).toLocaleString()}
            </div>
            {memory.unlockDate && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {isLocked ? 'Unlocks' : 'Unlocked'}: {new Date(memory.unlockDate).toLocaleString()}
              </div>
            )}
          </div>

          {isLocked ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                Memory Locked
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                This memory will unlock on {new Date(memory.unlockDate!).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <>
              {memory.textMemory && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Memory
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {getDisplayText()}
                  </p>
                </div>
              )}

              {memory.audioBlob && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Voice Memory
                  </h4>
                  <button
                    onClick={playAudio}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center"
                  >
                    ▶️ Play Audio
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<any>(null);
  const [encryptionKey, setEncryptionKey] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setEncryptionKey(s.encryptionKey || '');
    });
  }, []);

  const handleSaveSettings = async () => {
    try {
      const { saveSettings } = await import('../utils/db');
      await saveSettings({
        ...settings,
        encryptionKey: encryptionKey.trim() || undefined,
      });
      alert('Settings saved');
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleExport = async () => {
    try {
      const { exportAllData } = await import('../utils/export');
      await exportAllData();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { importData } = await import('../utils/export');
      const count = await importData(file);
      alert(`Successfully imported ${count} memories`);
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed');
    }
  };

  if (!settings) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold dark:text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            {/* Encryption */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.encryptionEnabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    encryptionEnabled: e.target.checked
                  })}
                  className="mr-2"
                />
                <span className="dark:text-white">Enable Encryption</span>
              </label>
              {settings.encryptionEnabled && (
                <input
                  type="password"
                  placeholder="Encryption key"
                  value={encryptionKey}
                  onChange={(e) => setEncryptionKey(e.target.value)}
                  className="mt-2 w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              )}
            </div>

            {/* Export/Import */}
            <div className="pt-4 border-t dark:border-gray-600">
              <h3 className="font-medium dark:text-white mb-2">Data Management</h3>
              <div className="space-y-2">
                <button
                  onClick={handleExport}
                  className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                >
                  Export All Data
                </button>
                <label className="block">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <div className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 text-center cursor-pointer">
                    Import Data
                  </div>
                </label>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2 border rounded dark:border-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | undefined>();
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      const allMemories = await getAllMemories();
      // Sort by creation date, newest first
      allMemories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMemories(allMemories);
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
  };

  const handleSaveMemory = () => {
    loadMemories();
    setEditingMemory(undefined);
  };

  const handleEditMemory = (memory: Memory) => {
    setEditingMemory(memory);
    setIsModalOpen(true);
  };

  const handleViewMemory = (memory: Memory) => {
    setViewingMemory(memory);
    setIsViewModalOpen(true);
  };

  const handleDeleteMemory = async (memory: Memory) => {
    if (confirm('Are you sure you want to delete this memory?')) {
      try {
        const { deleteMemory } = await import('../utils/db');
        await deleteMemory(memory.id);
        loadMemories();
      } catch (error) {
        console.error('Failed to delete memory:', error);
        alert('Failed to delete memory');
      }
    }
  };

  return (
    <>
      <Head>
        <title>Smart Memories</title>
        <meta name="description" content="Capture and preserve memories with your photos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Smart Memories
              </h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ⚙️
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Add Memory Button */}
          <div className="mb-8">
            <button
              onClick={() => {
                setEditingMemory(undefined);
                setIsModalOpen(true);
              }}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 flex items-center space-x-2 shadow-lg"
            >
              <span className="text-xl">+</span>
              <span>Add New Memory</span>
            </button>
          </div>

          {/* Memory Grid */}
          {memories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                No memories yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Start capturing your precious moments with photos and memories
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {memories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onClick={() => handleViewMemory(memory)}
                  onDelete={() => handleDeleteMemory(memory)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Modals */}
        <MemoryModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingMemory(undefined);
          }}
          memory={editingMemory}
          onSave={handleSaveMemory}
        />

        <ViewMemoryModal
          memory={viewingMemory}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingMemory(null);
          }}
        />
      </div>
    </>
  );
}