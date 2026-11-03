import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Clip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { addClip, expandSelection, moveClips, trimClip } from './clips';
import { assertUnlocked, requireClip } from './helpers';

const times = (p: Project) => p.markers.map((m) => m.time).sort((a, b) => a - b);
