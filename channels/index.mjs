import * as telegram from './telegram.mjs';
import * as ntfy from './ntfy.mjs';
import * as slack from './slack.mjs';
import * as discord from './discord.mjs';
import * as macos from './macos.mjs';
import * as pushover from './pushover.mjs';
import * as bark from './bark.mjs';
import * as gotify from './gotify.mjs';
import * as homeassistant from './homeassistant.mjs';
import * as apprise from './apprise.mjs';

export const CHANNELS = { telegram, ntfy, slack, discord, macos, pushover, bark, gotify, homeassistant, apprise };
