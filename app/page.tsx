"use client";
import { useState, useRef, useEffect } from "react";

class AudioPlayer {
  private audioContext: AudioContext | null;
  private audioSource: AudioBufferSourceNode | null;
  private destination: MediaStreamAudioDestinationNode | null;

  constructor() {
    this.audioContext = null;
    this.audioSource = null;
    this.destination = null;
  }

  async init(outputDeviceId?: string): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (outputDeviceId) {
        const audioDestination =
          this.audioContext.createMediaStreamDestination();
        this.destination = audioDestination;

        const audio = new Audio();
        audio.srcObject = audioDestination.stream;
        await audio.setSinkId(outputDeviceId); // Set the output device
        audio.play();
      }
    } catch (error) {
      console.error("Error initializing audio context:", error);
      throw error;
    }
  }

  async playAudio(audioUrl: string): Promise<AudioBufferSourceNode> {
    if (!this.audioContext) {
      throw new Error("AudioContext not initialized");
    }

    try {
      if (this.audioSource) {
        this.audioSource.stop();
      }

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.audioSource = this.audioContext.createBufferSource();
      this.audioSource.buffer = audioBuffer;

      this.audioSource.connect(
        this.destination || this.audioContext.destination
      );

      this.audioSource.start(0);

      return this.audioSource;
    } catch (error) {
      console.error("Error playing audio:", error);
      throw error;
    }
  }

  stopAudio(): void {
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource = null;
    }
  }
}

export default function Home() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioPlayer] = useState<AudioPlayer>(() => new AudioPlayer());
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [recordings, setRecordings] = useState<string[]>([]); // To store the audio URLs
  const [isRecording, setIsRecording] = useState<boolean>(false); // To track recording status
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const initDevices = async (): Promise<void> => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices);
      } catch (error) {
        console.error("Error fetching audio devices:", error);
      }
    };

    initDevices();
  }, []);

  useEffect(() => {
    const initAudio = async (): Promise<void> => {
      try {
        await audioPlayer.init(selectedOutput);
      } catch (error) {
        console.error("Error in audio initialization:", error);
      }
    };

    initAudio();
  }, [audioPlayer, selectedOutput]);

  const handlePlayClick = async (audioUrl: string): Promise<void> => {
    try {
      if (!audioPlayer) {
        console.error("Audio player is not initialized");
        return;
      }

      const source = await audioPlayer.playAudio(audioUrl);
      audioSourceRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        setIsPlaying(false);
        audioSourceRef.current = null;
      };
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
    }
  };

  const handleStopClick = (): void => {
    if (audioSourceRef.current) {
      audioPlayer.stopAudio();
      setIsPlaying(false);
      audioSourceRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordings((prev) => [...prev, audioUrl]);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-6 bg-gray-900 text-white">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-2">Audio Player</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select your input/output devices, record, and play audio.
        </p>
      </div>

      {/* Device Selectors */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block mb-2 text-sm">Select Output Device:</label>
          <select
            className="p-2 rounded bg-gray-800 text-white"
            value={selectedOutput}
            onChange={(e) => setSelectedOutput(e.target.value)}
          >
            <option value="">Default Output</option>
            {audioDevices
              .filter((device) => device.kind === "audiooutput")
              .map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Output Device ${device.deviceId}`}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="mt-6">
        {isRecording ? (
          <button
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
            onClick={handleStopRecording}
          >
            Stop Recording
          </button>
        ) : (
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
            onClick={handleStartRecording}
          >
            Start Recording
          </button>
        )}
      </div>

      {/* Play/Stop Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          onClick={() => handlePlayClick("/sample.mp3")}
          disabled={isPlaying}
        >
          {isPlaying ? "Playing..." : "Play Audio"}
        </button>

        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
          onClick={handleStopClick}
          disabled={!isPlaying}
        >
          Stop Audio
        </button>
      </div>

      {/* Recording Buttons */}
      <div className="mt-6">
        {recordings.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {recordings.map((url, index) => (
              <button
                key={index}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                onClick={() => handlePlayClick(url)}
              >
                Play Recording {index + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
