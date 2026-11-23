// Publish an over-the-air update to the preview builds: npm run update:preview
// (Ronda ships preview builds only; the channel list below is the one place to add another.)
//
// `eas update --environment <name>` bundles with that EAS environment's variables and ignores .env.
// If EXPO_PUBLIC_API_URL is missing there, the bundle falls back to the emulator address in
// src/api/client.ts and every phone on the channel loses the API. So this checks the variable
// first, then runs `eas update`, which asks for the update message.
import { spawnSync } from 'node:child_process';

const CHANNELS = ['preview'];
const channel = process.argv[2];
if (!CHANNELS.includes(channel)) {
  console.error(`Usage: node scripts/publish-update.mjs <${CHANNELS.join('|')}>`);
  process.exit(1);
}

// The channel and environment share a name (eas.json gives the preview profile both).
// Fixed words only, so the command line is safe to hand to the shell (npx is npx.cmd on Windows).
const run = (command, options) => spawnSync(command, { shell: true, ...options });
const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};
const setCommand = `npx eas-cli@latest env:set ${channel} --name EXPO_PUBLIC_API_URL --value <api-url> --visibility plaintext`;

const lookup = run(`npx --yes eas-cli@latest env:get ${channel} --variable-name EXPO_PUBLIC_API_URL --non-interactive`, {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'inherit'],
});
// A missing variable prints "not found" and still exits 0, so read the output itself.
const output = (lookup.stdout ?? '').replace(/\x1b\[[0-9;]*m/g, '');
const apiUrl = output.match(/^EXPO_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim();

if (lookup.status !== 0 || !apiUrl) {
  fail(`EXPO_PUBLIC_API_URL is not set in the EAS "${channel}" environment, so the update would not know the API address.
Set it to the address the ${channel} builds use, then publish again:

  ${setCommand}`);
}
// Secret variables never leave EAS builders, so eas update cannot read them.
if (/secret env variable/i.test(apiUrl)) {
  fail(`EXPO_PUBLIC_API_URL in "${channel}" is a secret variable, which eas update cannot read. Set it again as plain text:

  ${setCommand}`);
}
const hidden = apiUrl.startsWith('*****');
if (!hidden && /^https?:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiUrl)) {
  fail(`EXPO_PUBLIC_API_URL in "${channel}" is ${apiUrl}, which only works on an emulator. Set the address phones can reach:

  ${setCommand}`);
}

console.log(`Publishing to the "${channel}" channel. The update will call the API at ${hidden ? 'the address set in EAS (sensitive)' : apiUrl}.\n`);
const update = run(`npx --yes eas-cli@latest update --channel ${channel} --environment ${channel}`, { stdio: 'inherit' });
process.exit(update.status ?? 1);
