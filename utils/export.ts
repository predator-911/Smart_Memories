import JSZip from 'jszip';
import { Memory, getAllMemories, blobToDataUrl, dataUrlToBlob, saveMemory } from './db';

export async function exportAllData(): Promise<void> {
  try {
    const memories = await getAllMemories();
    const zip = new JSZip();

    const exportData: {
      version: string;
      exportDate: string;
      memories: Array<Memory & {
        photoDataUrl: string;
        audioDataUrl?: string;
      }>;
    } = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      memories: [],
    };

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      const photoDataUrl = await blobToDataUrl(memory.photoBlob);
      const audioDataUrl = memory.audioBlob
        ? await blobToDataUrl(memory.audioBlob)
        : undefined;

      exportData.memories.push({
        ...memory,
        photoDataUrl,
        audioDataUrl,
      });

      // Save individual files
      zip.file(`photos/photo_${i + 1}_${memory.id}.jpg`, memory.photoBlob);
      if (memory.audioBlob) {
        zip.file(`audio/audio_${i + 1}_${memory.id}.webm`, memory.audioBlob);
      }
    }

    // Add the export JSON and a README
    zip.file('memories_data.json', JSON.stringify(exportData, null, 2));
    zip.file('README.txt', generateReadme());

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_memories_export_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
    throw new Error('Failed to export data');
  }
}

export async function importData(file: File): Promise<number> {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData.memories || !Array.isArray(importData.memories)) {
      throw new Error('Invalid import file format');
    }

    let count = 0;
    for (const memory of importData.memories) {
      try {
        const photoBlob = dataUrlToBlob(memory.photoDataUrl);
        const audioBlob = memory.audioDataUrl
          ? dataUrlToBlob(memory.audioDataUrl)
          : undefined;

        const newMemory: Memory = {
          id: memory.id,
          photoUrl: memory.photoUrl,
          photoBlob,
          audioBlob,
          textMemory: memory.textMemory,
          unlockDate: memory.unlockDate,
          isEncrypted: memory.isEncrypted,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        };

        await saveMemory(newMemory);
        count++;
      } catch (err) {
        console.error(`Failed to import memory ${memory.id}:`, err);
      }
    }

    return count;
  } catch (err) {
    console.error('Import failed:', err);
    throw new Error('Failed to import data');
  }
}

function generateReadme(): string {
  return `Smart Memories Export
=====================

This ZIP contains all your memories from the Smart Memories app.

Folders:
- memories_data.json: Full export with metadata and base64 images/audio
- photos/: Individual photo files
- audio/: Individual audio files

To restore:
1. Open Smart Memories app
2. Go to Settings → Import
3. Select "memories_data.json"

Exported: ${new Date().toLocaleString()}
Version: 1.0.0
`;
}
