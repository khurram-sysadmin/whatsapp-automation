// Record locally, then encode to the MP3 format already accepted by our sender.
// No audio leaves this tab until the customer submits their message/campaign.
export const MAX_RECORDING_SECONDS = 300;
export async function encodeVoiceNote(samples: Float32Array, sampleRate: number, signal?: AbortSignal): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, sampleRate, 96);
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < samples.length; offset += 1152) {
    if (offset % (1152 * 64) === 0) {
      signal?.throwIfAborted();
      // Keep Stop/Discard and navigation responsive during longer recordings.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const floats = samples.subarray(offset, offset + 1152);
    const pcm = Int16Array.from(floats, sample => {
      const clipped = Math.max(-1, Math.min(1, sample));
      return Math.round(clipped * (clipped < 0 ? 32768 : 32767));
    });
    const encoded = encoder.encodeBuffer(pcm);
    if (encoded.length) chunks.push(Uint8Array.from(encoded).buffer);
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(Uint8Array.from(tail).buffer);
  return new Blob(chunks, { type: 'audio/mpeg' });
}

export async function recordingToFile(blob: Blob, signal?: AbortSignal): Promise<File> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    signal?.throwIfAborted();
    if (!audio.length || audio.duration > MAX_RECORDING_SECONDS + 3) throw Error('Please record a voice note of five minutes or less.');
    const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 44100), 44100);
    const source = offline.createBufferSource();
    source.buffer = audio;
    source.connect(offline.destination);
    source.start();
    const mono = await offline.startRendering();
    const mp3 = await encodeVoiceNote(mono.getChannelData(0), 44100, signal);
    return new File([mp3], `voice-note-${Date.now()}.mp3`, { type: 'audio/mpeg' });
  } finally { await context.close(); }
}
