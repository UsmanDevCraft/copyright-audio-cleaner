"use client";

import { useState } from "react";
import { processAudioFile } from "@/src/lib/audioProcessor";
import { convertWavToMp3 } from "@/src/lib/ffmpeg";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Select an audio file to begin...",
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cleanedFileName, setCleanedFileName] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      setStatusMessage(`Loaded: ${file.name}`);
      setDownloadUrl(null);
    }
  };

  const handleProcessAudio = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);

      // Step 1: Web Audio API DSP Shift
      setStatusMessage("Step 1/2: Applying DSP pitch & tempo micro-shifts...");
      const { wavBlob, originalName } = await processAudioFile(selectedFile, {
        detuneCents: -10,
        tempoMultiplier: 1.008,
      });

      // Step 2: FFmpeg WASM Compression
      setStatusMessage(
        "Step 2/2: Compressing to 320 kbps MP3 & stripping metadata...",
      );
      const mp3Blob = await convertWavToMp3(wavBlob);

      const url = URL.createObjectURL(mp3Blob);
      const cleanName = `cleaned_${originalName.replace(/\.[^/.]+$/, "")}.mp3`;

      setDownloadUrl(url);
      setCleanedFileName(cleanName);
      setStatusMessage("Processing complete! Clean MP3 ready (~3-4 MB).");
    } catch (err) {
      console.error(err);
      setStatusMessage(
        "Error processing audio file. Make sure your browser supports WebAssembly.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        padding: "3rem",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "#1e293b",
          padding: "2rem",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
          }}
        >
          Audio Cleaner (DSP + WASM)
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "0.9rem",
            marginBottom: "1.5rem",
          }}
        >
          Shift fingerprints and export clean, lightweight 320kbps MP3s.
        </p>

        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          style={{ marginBottom: "1rem", display: "block", width: "100%" }}
        />

        <button
          onClick={handleProcessAudio}
          disabled={!selectedFile || isProcessing}
          style={{
            backgroundColor:
              !selectedFile || isProcessing ? "#475569" : "#3b82f6",
            color: "white",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: !selectedFile || isProcessing ? "not-allowed" : "pointer",
            width: "100%",
          }}
        >
          {isProcessing ? "Processing..." : "Clean Audio"}
        </button>

        <p
          style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#38bdf8" }}
        >
          {statusMessage}
        </p>

        {downloadUrl && (
          <a
            href={downloadUrl}
            download={cleanedFileName}
            style={{
              display: "block",
              marginTop: "1rem",
              color: "#4ade80",
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            Download Cleaned MP3 (.mp3)
          </a>
        )}
      </div>
    </main>
  );
}
