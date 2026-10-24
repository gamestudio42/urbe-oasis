import type { MusicEngine } from '@oasis/web/audio/sound';
import type { TrackId } from './composer';
import { OasisMusic } from './music';

/** The shared board owns the audio context; Oasis owns its score and instruments. */
export function oasisMusicFactory(
  ctx: AudioContext,
  bus: GainNode,
  noise: AudioBuffer,
): MusicEngine {
  const player = new OasisMusic(ctx, bus, noise);
  let track: TrackId = 'menu';
  return {
    get state() {
      return player.state;
    },
    start() {
      player.start(track);
    },
    stop() {
      player.stop();
    },
    setTrack(next) {
      track = next;
      player.setTrack(next);
    },
    setDucked(next) {
      player.setPaused(next);
    },
    dispose() {
      player.dispose();
    },
  };
}
