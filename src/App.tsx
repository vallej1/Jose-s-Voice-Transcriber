import React, { useState, useRef, useEffect } from "react";
import { Mic, Upload, StopCircle, Play, FileAudio, Loader2, CheckCircle2, AlertCircle, Trash2, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { transcribeAudio, transcribeWithSpeakers } from "./services/gemini";

type Mode = "realtime" | "upload";

export default function App() {
  const [mode, setMode] = useState<Mode>("realtime");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Timer for recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    try {
      setError(null);
      setTranscription("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob, "audio/webm");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release the microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setError(null);
      setTranscription("");
    }
  };

  const processUploadedFile = async () => {
    if (!audioFile) return;
    await processAudio(audioFile, audioFile.type, true);
  };

  const processAudio = async (audioBlob: Blob, mimeType: string, isDiarization: boolean = false) => {
    setIsProcessing(true);
    setError(null);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      let result = "";
      if (isDiarization) {
        result = await transcribeWithSpeakers(base64Audio, mimeType);
      } else {
        result = await transcribeAudio(base64Audio, mimeType);
      }
      setTranscription(result);
    } catch (err) {
      console.error("Transcription failed:", err);
      setError("Failed to transcribe audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setTranscription("");
    setAudioFile(null);
    setError(null);
    setCopied(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"
          >
            Jose's Voice Transcriber
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-neutral-500 text-lg"
          >
            Convert speech and recordings into accurate text using Gemini AI.
          </motion.p>
        </header>

        {/* Mode Selector */}
        <div className="flex justify-center mb-8">
          <div className="bg-neutral-200 p-1 rounded-2xl flex gap-1 shadow-inner">
            <button
              onClick={() => { setMode("realtime"); clearAll(); }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-200 ${
                mode === "realtime" 
                  ? "bg-white text-emerald-600 shadow-md font-medium" 
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Mic size={18} />
              Real-time
            </button>
            <button
              onClick={() => { setMode("upload"); clearAll(); }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-200 ${
                mode === "upload" 
                  ? "bg-white text-emerald-600 shadow-md font-medium" 
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Upload size={18} />
              Upload
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="bg-white rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-200 overflow-hidden">
          <div className="p-8">
            <AnimatePresence mode="wait">
              {mode === "realtime" ? (
                <motion.div
                  key="realtime"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  <div className="relative mb-8">
                    {isRecording && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 0.2 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 bg-emerald-500 rounded-full"
                      />
                    )}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                      className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isRecording 
                          ? "bg-red-500 hover:bg-red-600 text-white" 
                          : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isRecording ? <StopCircle size={40} /> : <Mic size={40} />}
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <p className={`text-xl font-medium mb-2 ${isRecording ? "text-red-500" : "text-neutral-700"}`}>
                      {isRecording ? `Recording... ${formatTime(recordingTime)}` : "Tap to start talking"}
                    </p>
                    <p className="text-neutral-400 text-sm">
                      {isRecording ? "Tap again to stop and transcribe" : "Your voice will be converted to text automatically"}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  {!audioFile ? (
                    <label className="w-full max-w-md border-2 border-dashed border-neutral-300 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
                      <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                        <FileAudio className="text-neutral-400 group-hover:text-emerald-600" size={32} />
                      </div>
                      <p className="text-neutral-700 font-medium mb-1">Click to upload audio</p>
                      <p className="text-neutral-400 text-sm">MP3, WAV, M4A, etc. (Max 10MB recommended)</p>
                    </label>
                  ) : (
                    <div className="w-full max-w-md bg-neutral-50 border border-neutral-200 rounded-3xl p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                          <FileAudio size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 truncate">{audioFile.name}</p>
                          <p className="text-sm text-neutral-500">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                        <button onClick={() => setAudioFile(null)} className="text-neutral-400 hover:text-red-500 transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                      <button
                        onClick={processUploadedFile}
                        disabled={isProcessing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                        {isProcessing ? "Transcribing..." : "Start Transcription"}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Messages */}
            {isProcessing && mode === "realtime" && (
              <div className="flex items-center justify-center gap-3 text-emerald-600 font-medium py-4">
                <Loader2 className="animate-spin" size={20} />
                Processing your recording...
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                <AlertCircle size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Transcription Result */}
            {transcription && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 pt-8 border-t border-neutral-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                    <CheckCircle2 size={20} />
                    Transcription Result
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-emerald-600 transition-colors"
                  >
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </button>
                </div>
                <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200 max-h-[400px] overflow-y-auto whitespace-pre-wrap text-neutral-700 leading-relaxed">
                  {transcription}
                </div>
              </motion.div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-neutral-400 text-sm">
          <p>Powered by Google Gemini 3 Flash</p>
          <p className="mt-1">Built with React & Tailwind CSS</p>
        </footer>
      </div>
    </div>
  );
}
