import { TimelineError } from '../errors';
import { newId } from '../ids';
import { allClips, projectDuration } from '../project';
import type { Marker, Project, Track } from '../schema';
import { clipEnd, round6 } from '../time';
import { requireTrack } from './helpers';

const sortMarkers = (ms: Marker[]) => [...ms].sort((a, b) => a.time - b.time);
const hasMarkerAt = (ms: Marker[], t: number) => ms.some((m) => Math.abs(m.time - t) < 1e-3);
