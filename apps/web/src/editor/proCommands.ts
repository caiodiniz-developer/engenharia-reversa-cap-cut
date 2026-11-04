import * as core from '@editor/core';
import { findClip } from '@editor/core';
import { toast } from '../store/toasts';
import type { Command } from './commands';
import { applyCounted, atLeast, cmd, createAndSelect, focusTrackId, hasSel, hasTrack, onSelection, oneMedia, s, sel } from './commandKit';

const noun = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
const kindOf = (id: string) => findClip(s().project, id)?.clip.type;
const G = 'Edição pro';
