import type { MusicEngine } from '@oasis/web/audio/sound';
import type { TrackId } from '@oasis/web/audio/composer';
import { OasisMusic } from './music';

/**
 * Bridges the synthwave player into the shared `SoundBoard`.
 *
 * The board owns the AudioContext, the master gain and the mute flag; the Neo player only needs
 * the destination bus. This adapter keeps the board's `MusicEngine` contract (start/stop/track/
 * duck) without teaching the shared code about synthwave.
 */
export function oasisMusicFactory(
  ctx: AudioContext,
  bus: GainNode,
  _noise: AudioBuffer,
): MusicEngine {
  const player = new OasisMusic(ctx, bus);
  let track: TrackId = 'menu';
  let ducked = false;
  let started = false;
  return {
    get state() {
      return player.state;
    },
    start() {
      if (started) return;
      started = true;
      void player.start(track);
    },
    stop() {
      started = false;
      player.stop();
    },
    setTrack(next: TrackId) {
      track = next;
      if (started) player.setTrack(next);
    },
    setDucked(next: boolean) {
      ducked = next;
      player.setPaused(next);
    },
    dispose() {
      player.stop();
      void ducked;
    },
  };
}
